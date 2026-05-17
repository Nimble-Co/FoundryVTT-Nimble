import type {
	AttackDelivery,
	AutoBonusSummary,
	SpendableChargePool,
	SpendablePool,
} from '#types/components/ItemActivationConfigDialog.d.ts';
import { getPools as getChargePools } from '#utils/chargePool/chargePoolSync.js';
import { getPools as getDicePools } from '#utils/dicePool/dicePoolSync.js';
import { flattenEffectsTree } from '../../utils/treeManipulation/flattenEffectsTree.js';

/**
 * Read the activation's attack delivery (melee / ranged / null) from the
 * item's activation targets. Mirrors ItemActivationManager#getRolls.
 */
export function getAttackDeliveryFromActivation(item: Item): AttackDelivery {
	const attackType = (
		item.system as { activation?: { targets?: { attackType?: string } } } | undefined
	)?.activation?.targets?.attackType;
	if (attackType === 'reach') return 'melee';
	if (attackType === 'range') return 'ranged';
	return null;
}

/**
 * `bonusOnAttackDelivery: 'any'` (or absent/null) matches any delivery;
 * otherwise the filter must equal the activation's delivery.
 */
export function matchesAttackDelivery(
	filter: 'melee' | 'ranged' | 'any' | null | undefined,
	delivery: AttackDelivery,
): boolean {
	if (filter === null || filter === undefined || filter === 'any') return true;
	return filter === delivery;
}

/**
 * Snapshot the actor's rolled dice pools that currently have rolled faces.
 * Used at dialog-open time so the UI is stable if pool state changes mid-dialog.
 */
export function extractRolledPools(actor: Actor): SpendablePool[] {
	return getDicePools(actor)
		.filter((pool) => pool.faces.length > 0)
		.map((pool) => ({
			id: pool.id,
			identifier: pool.identifier,
			label: pool.label,
			dieSize: pool.dieSize,
			faces: [...pool.faces],
			consumption: pool.consumption ?? 'manual',
			bonusOnAttackDelivery: pool.bonusOnAttackDelivery ?? null,
		}));
}

/**
 * Snapshot the actor's charge pools that roll dice on spend (Combat Dice,
 * Mana Dice). Skips zero-current pools and pools without a die-size hint.
 */
export function extractSpendableChargePools(actor: Actor): SpendableChargePool[] {
	return getChargePools(actor)
		.filter(
			(pool): pool is typeof pool & { dieSize: string } => pool.dieSize != null && pool.current > 0,
		)
		.map((pool) => ({
			id: pool.id,
			identifier: pool.identifier,
			label: pool.label,
			dieSize: pool.dieSize,
			current: pool.current,
			max: pool.max,
		}));
}

/**
 * Per-pool summary of every face plus its sum. autoBonus pools auto-apply
 * to every qualifying attack with no opt-in and no consumption.
 */
export function buildAutoBonusSummaries(autoBonusPools: SpendablePool[]): AutoBonusSummary[] {
	return autoBonusPools.map((pool) => ({
		id: pool.id,
		label: pool.label,
		faces: pool.faces,
		total: pool.faces.reduce((sum, face) => sum + face, 0),
	}));
}

/**
 * Foundry roll-formula fragment for the autoBonus pools, with each face
 * appended as `+N[Label]` so the roll tooltip credits the source pool.
 */
export function buildAutoBonusFormula(autoBonusPools: SpendablePool[]): string {
	return autoBonusPools
		.flatMap((pool) => pool.faces.map((face) => `+${face}[${pool.label}]`))
		.join('');
}

/**
 * Walk the item's activation effects tree and collect top-level damage
 * effects (excluding conditional damage like criticalHit / miss / hit /
 * failedSaveBy). Also pulls damage out of savingThrow#sharedRolls.
 */
export function extractDamageEffectsFromItem(
	item: Item,
): Array<{ formula: string; damageType?: string }> {
	const effects =
		(item.system as { activation?: { effects?: unknown[] } } | undefined)?.activation?.effects ??
		[];
	const allDamageEffects: Array<{ formula: string; damageType?: string }> = [];

	const flattened = flattenEffectsTree(effects as Parameters<typeof flattenEffectsTree>[0]);
	for (const effect of flattened) {
		const ctx = (effect as { parentContext?: string }).parentContext;
		const isConditional =
			(ctx && ['criticalHit', 'miss', 'hit'].includes(ctx)) || ctx?.startsWith('failedSaveBy');

		if ((effect as { type?: string }).type === 'damage' && !isConditional) {
			allDamageEffects.push({
				formula: (effect as { formula?: string }).formula || '0',
				damageType: (effect as { damageType?: string }).damageType,
			});
		}
	}

	for (const effect of effects as Array<{ type?: string; sharedRolls?: unknown[] }>) {
		if (effect.type === 'savingThrow' && effect.sharedRolls) {
			for (const sharedRoll of effect.sharedRolls as Array<{
				type?: string;
				formula?: string;
				damageType?: string;
			}>) {
				if (sharedRoll.type === 'damage') {
					const exists = allDamageEffects.some(
						(d) => d.formula === sharedRoll.formula && d.damageType === sharedRoll.damageType,
					);
					if (!exists) {
						allDamageEffects.push({
							formula: sharedRoll.formula || '0',
							damageType: sharedRoll.damageType,
						});
					}
				}
			}
		}
	}

	if (allDamageEffects.length === 0) {
		return [{ formula: '0' }];
	}

	return allDamageEffects;
}
