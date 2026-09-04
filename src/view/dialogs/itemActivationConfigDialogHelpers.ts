import type {
	AttackDelivery,
	AutoBonusSummary,
	SpendableChargePool,
	SpendablePool,
	VariableChargeSpend,
} from '#types/components/ItemActivationConfigDialog.d.ts';
import { attackDeliveryFromAttackType } from '#utils/attackDelivery.js';
import { getPools as getChargePools } from '#utils/chargePool/chargePoolSync.js';
import { getChargeConsumers } from '#utils/chargePool/helpers.js';
import type { CharacterActorLike, RuleBackedItem } from '#utils/chargePool/types.js';
import { getPools as getDicePools } from '#utils/dicePool/dicePoolSync.js';
import { flattenEffectsTree } from '../../utils/treeManipulation/flattenEffectsTree.js';

/**
 * Read the activation's attack delivery (melee / ranged / null) from the
 * item's activation targets. The manager reads the same shape off its
 * post-upcast activation data instead of off the item.
 */
export function getAttackDeliveryFromActivation(item: Item): AttackDelivery {
	return attackDeliveryFromAttackType(
		(item.system as { activation?: { targets?: { attackType?: string } } } | undefined)?.activation
			?.targets?.attackType,
	);
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
 * Mana Dice). Skips zero-current pools, pools without a die-size hint, and
 * pools flagged `hidden` (those are internal gates, not resources the player
 * chooses to spend here).
 */
export function extractSpendableChargePools(actor: Actor): SpendableChargePool[] {
	return getChargePools(actor)
		.filter(
			(pool): pool is typeof pool & { dieSize: string } =>
				pool.dieSize != null && pool.current > 0 && !pool.hidden,
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
 * The charge pools this item spends a player-chosen amount from, with the
 * bounds that choice has to stay inside. Unlike `extractSpendableChargePools`,
 * which offers every rollable pool on the actor as an attack bonus, a variable
 * spend belongs to the item being activated: the amount chosen is what the
 * activation does, not a rider on it, so the item's own effect formulas read it
 * back as `@spent`.
 *
 * A pool with fewer charges than the consumer's minimum is dropped rather than
 * offered at 0 — there is nothing to choose.
 */
export function extractVariableChargeSpends(actor: Actor, item: Item): VariableChargeSpend[] {
	const consumers = getChargeConsumers(actor as CharacterActorLike, item as RuleBackedItem, {
		includeVariable: true,
	}).filter((consumer) => consumer.variable);
	if (consumers.length === 0) return [];

	const pools = getChargePools(actor);
	const spends: VariableChargeSpend[] = [];

	for (const consumer of consumers) {
		const pool = pools.find((candidate) => candidate.id === consumer.poolId);
		if (!pool || pool.hidden) continue;

		const minimum = Math.max(1, consumer.cost);
		const limit =
			consumer.maxCost === null ? pool.current : Math.min(consumer.maxCost, pool.current);
		if (limit < minimum) continue;

		spends.push({
			poolId: pool.id,
			identifier: pool.identifier,
			label: pool.label,
			current: pool.current,
			max: pool.max,
			minimum,
			limit,
		});
	}

	return spends;
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
 *
 * An item with no damage at all returns nothing rather than a `0` placeholder:
 * the callers that need a formula already default to `'0'`, and the dialog's
 * preview would otherwise show a bare `0` for an activation that rolls
 * healing, or nothing at all.
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

	return allDamageEffects;
}
