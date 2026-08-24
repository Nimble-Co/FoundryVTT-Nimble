import { isResourceSpendingAutomationEnabled } from '../../settings/automationSettings.js';
import { emitForCharacter } from '../chargePool/chargePoolHooks.js';
import {
	buildEffectiveChargePoolMap,
	clampCurrentToMax,
	persistChargePoolMap,
	resolveFormulaToInteger,
} from '../chargePool/helpers.js';
import type { CharacterActorLike, ChargePoolMap } from '../chargePool/types.js';

type OverdraftConsequence = '' | 'halfMaxHpDamage';

interface ClassSpellcastingDeclaration {
	castAtHighestTier?: boolean;
	cost?: {
		poolIdentifier?: string;
		amount?: string;
		overdraftConsequence?: OverdraftConsequence;
	};
}

interface SpellCostActorLike {
	type?: string;
	items?: { contents?: Array<{ type?: string; system?: unknown }> };
	system?: {
		resources?: {
			mana?: { current?: number };
			highestUnlockedSpellTier?: number | null;
		};
		attributes?: { hp?: { max?: number } };
	};
	update?: (changes: Record<string, unknown>) => Promise<unknown>;
	applyDamage?: (damage: number) => Promise<void>;
}

interface SpellLike {
	system?: { tier?: number };
}

export type ResolvedSpellCost =
	| { type: 'none' }
	| { type: 'mana'; amount: number }
	| {
			type: 'pool';
			poolIdentifier: string;
			poolLabel: string;
			amount: number;
			overdraftConsequence: OverdraftConsequence;
	  };

export interface SpellCostValidation {
	ok: boolean;
	overdrawn: boolean;
	/** The pool's current value when the cast would overdraw it. */
	available?: number;
	failure?: {
		code: 'poolMissing' | 'insufficientCharges';
		poolIdentifier: string;
		poolLabel: string;
		required: number;
		available: number;
	};
}

function getClassSpellcasting(actorInput: unknown): ClassSpellcastingDeclaration | null {
	const actor = actorInput as SpellCostActorLike;
	for (const item of actor?.items?.contents ?? []) {
		if (item.type !== 'class') continue;
		const spellcasting = (
			item.system as { spellcasting?: ClassSpellcastingDeclaration } | undefined
		)?.spellcasting;
		if (!spellcasting) continue;
		const poolIdentifier = spellcasting.cost?.poolIdentifier?.trim() ?? '';
		if (poolIdentifier.length > 0 || spellcasting.castAtHighestTier) return spellcasting;
	}
	return null;
}

function findPoolEntry(
	pools: ChargePoolMap,
	poolIdentifier: string,
): { key: string; pool: ChargePoolMap[string] } | null {
	const bareEntry = pools[poolIdentifier];
	if (bareEntry) return { key: poolIdentifier, pool: bareEntry };
	const actorScopedKey = `actor:${poolIdentifier}`;
	const actorEntry = pools[actorScopedKey];
	if (actorEntry) return { key: actorScopedKey, pool: actorEntry };
	return null;
}

/**
 * Resolves what a cast of the given spell costs the given actor: nothing for
 * cantrips, the cast tier in mana by default, or the flat pool cost the
 * actor's class declares. Cost resolution is independent of the resource
 * spending automation setting so the cost stays visible when automation is
 * off.
 */
export function resolveSpellCost(
	actorInput: unknown,
	spellInput: unknown,
	{ castTier }: { castTier?: number } = {},
): ResolvedSpellCost {
	const actor = actorInput as SpellCostActorLike;
	const spell = spellInput as SpellLike;
	const tier = spell?.system?.tier ?? 0;
	if (tier <= 0) return { type: 'none' };

	const spellcasting = getClassSpellcasting(actor);
	const poolIdentifier = spellcasting?.cost?.poolIdentifier?.trim() ?? '';
	if (poolIdentifier.length === 0) return { type: 'mana', amount: castTier ?? tier };

	const amount = Math.max(
		0,
		resolveFormulaToInteger(actor as CharacterActorLike, spellcasting?.cost?.amount ?? '1'),
	);
	const pools = buildEffectiveChargePoolMap(actor as CharacterActorLike);
	const poolEntry = findPoolEntry(pools, poolIdentifier);

	return {
		type: 'pool',
		poolIdentifier,
		poolLabel: poolEntry?.pool.label ?? poolIdentifier,
		amount,
		overdraftConsequence: spellcasting?.cost?.overdraftConsequence ?? '',
	};
}

/**
 * Resolves the tier a spell is cast at when the actor's class declares that
 * its spells always resolve at the highest unlocked tier. Returns null when
 * no class pins the tier, leaving the cast tier a player choice.
 */
export function resolvePinnedCastTier(actorInput: unknown, spellInput: unknown): number | null {
	const actor = actorInput as SpellCostActorLike;
	const spell = spellInput as SpellLike;
	const tier = spell?.system?.tier ?? 0;
	if (tier <= 0) return null;

	const spellcasting = getClassSpellcasting(actor);
	if (!spellcasting?.castAtHighestTier) return null;

	const unlockedTier = actor?.system?.resources?.highestUnlockedSpellTier ?? 0;
	return Math.max(tier, unlockedTier);
}

/**
 * Checks whether the actor can pay the resolved cost, without writing
 * anything. `overdrawn: true` means the pool cannot cover the cost but the
 * declared consequence permits the cast anyway; the caller decides whether
 * to confirm and proceed. With resource spending automation off, nothing is
 * validated and every cast is permitted.
 */
export function validateSpellCost(
	actorInput: unknown,
	cost: ResolvedSpellCost,
): SpellCostValidation {
	const actor = actorInput as SpellCostActorLike;
	if (!isResourceSpendingAutomationEnabled()) return { ok: true, overdrawn: false };
	if (cost.type !== 'pool') return { ok: true, overdrawn: false };

	const pools = buildEffectiveChargePoolMap(actor as CharacterActorLike);
	const poolEntry = findPoolEntry(pools, cost.poolIdentifier);
	if (!poolEntry) {
		return {
			ok: false,
			overdrawn: false,
			failure: {
				code: 'poolMissing',
				poolIdentifier: cost.poolIdentifier,
				poolLabel: cost.poolLabel,
				required: cost.amount,
				available: 0,
			},
		};
	}

	if (poolEntry.pool.current >= cost.amount) return { ok: true, overdrawn: false };
	if (cost.overdraftConsequence !== '') {
		return { ok: true, overdrawn: true, available: poolEntry.pool.current };
	}

	return {
		ok: false,
		overdrawn: false,
		failure: {
			code: 'insufficientCharges',
			poolIdentifier: cost.poolIdentifier,
			poolLabel: poolEntry.pool.label,
			required: cost.amount,
			available: poolEntry.pool.current,
		},
	};
}

/**
 * Pays the resolved cost: deducts mana, or deducts from the declared pool,
 * flooring at zero. Does not apply an overdraft consequence; the caller does
 * that after this resolves with `overdrawn: true`. With resource spending
 * automation off, nothing is deducted.
 */
export async function spendSpellCost(
	actorInput: unknown,
	cost: ResolvedSpellCost,
): Promise<SpellCostValidation> {
	const actor = actorInput as SpellCostActorLike;
	if (!isResourceSpendingAutomationEnabled()) return { ok: true, overdrawn: false };
	if (cost.type === 'none') return { ok: true, overdrawn: false };

	if (cost.type === 'mana') {
		const currentMana = actor?.system?.resources?.mana?.current || 0;
		await actor.update?.({
			'system.resources.mana.current': Math.max(0, currentMana - cost.amount),
		});
		return { ok: true, overdrawn: false };
	}

	const validation = validateSpellCost(actor, cost);
	if (!validation.ok) return validation;

	const pools = buildEffectiveChargePoolMap(actor as CharacterActorLike);
	const poolEntry = findPoolEntry(pools, cost.poolIdentifier);
	if (!poolEntry) return validation;

	const previousValue = poolEntry.pool.current;
	poolEntry.pool.current = clampCurrentToMax(
		Math.max(0, previousValue - cost.amount),
		poolEntry.pool.max,
	);
	await persistChargePoolMap(actor as CharacterActorLike, pools);

	emitForCharacter(actor as CharacterActorLike, 'changed', {
		actor: actor as CharacterActorLike,
		poolId: poolEntry.key,
		poolLabel: poolEntry.pool.label,
		previousValue,
		newValue: poolEntry.pool.current,
		maxValue: poolEntry.pool.max,
		reason: 'consume',
	});

	return { ok: true, overdrawn: validation.overdrawn };
}

/**
 * Computes the damage the declared overdraft consequence would deal, without
 * applying it. Used to tell the player what confirming will cost.
 */
export function previewOverdraftDamage(actorInput: unknown, cost: ResolvedSpellCost): number {
	const actor = actorInput as SpellCostActorLike;
	if (cost.type !== 'pool' || cost.overdraftConsequence !== 'halfMaxHpDamage') return 0;
	return Math.floor((actor?.system?.attributes?.hp?.max ?? 0) / 2);
}

/**
 * Applies the declared overdraft consequence and returns the damage dealt.
 */
export async function applyOverdraftConsequence(
	actorInput: unknown,
	cost: ResolvedSpellCost,
): Promise<number> {
	const actor = actorInput as SpellCostActorLike;
	const damage = previewOverdraftDamage(actor, cost);
	if (damage > 0) await actor.applyDamage?.(damage);
	return damage;
}
