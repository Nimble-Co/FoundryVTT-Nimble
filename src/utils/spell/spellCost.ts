import { isResourceSpendingAutomationEnabled } from '../../settings/automationSettings.js';
import { emitForCharacter } from '../chargePool/chargePoolHooks.js';
import {
	buildEffectiveChargePoolMap,
	clampCurrentToMax,
	findChargePoolByIdentifier,
	persistChargePoolMap,
	resolveFormulaToInteger,
} from '../chargePool/helpers.js';
import type { CharacterActorLike } from '../chargePool/types.js';
import localize from '../localize.js';

type OverdraftConsequence = '' | 'halfMaxHpDamage';

interface ClassSpellcastingDeclaration {
	castAtHighestTier?: boolean;
	cost?: {
		poolIdentifier?: string;
		amount?: string;
		overdraftConsequence?: OverdraftConsequence;
	};
}

/**
 * The structural slice of an actor this module reads and writes. Kept
 * separate from `CharacterActorLike` so callers with a partial actor (and
 * tests) can satisfy it without a full document.
 */
export interface SpellCostActorLike {
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

export interface SpellLike {
	system?: { tier?: number; scaling?: { mode?: string } | null };
}

/** The upcast selection a dialog would have returned. */
export interface UpcastSelection {
	manaToSpend: number;
	choiceIndex?: number;
}

/**
 * The chargePool helpers take a full character document. Everything they
 * touch is present on `SpellCostActorLike`, so the cast is confined here.
 */
function asChargePoolActor(actor: SpellCostActorLike): CharacterActorLike {
	return actor as unknown as CharacterActorLike;
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

function getClassSpellcasting(actor: SpellCostActorLike): ClassSpellcastingDeclaration | null {
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

/**
 * Resolves what a cast of the given spell costs the given actor: nothing for
 * cantrips, the cast tier in mana by default, or the flat pool cost the
 * actor's class declares. Cost resolution is independent of the resource
 * spending automation setting so the cost stays visible when automation is
 * off.
 */
export function resolveSpellCost(
	actor: SpellCostActorLike,
	spell: SpellLike,
	{ castTier }: { castTier?: number } = {},
): ResolvedSpellCost {
	const tier = spell?.system?.tier ?? 0;
	if (tier <= 0) return { type: 'none' };

	const spellcasting = getClassSpellcasting(actor);
	const poolIdentifier = spellcasting?.cost?.poolIdentifier?.trim() ?? '';
	if (poolIdentifier.length === 0) return { type: 'mana', amount: castTier ?? tier };

	const amount = Math.max(
		0,
		resolveFormulaToInteger(asChargePoolActor(actor), spellcasting?.cost?.amount ?? '1'),
	);
	const pools = buildEffectiveChargePoolMap(asChargePoolActor(actor));
	const poolEntry = findChargePoolByIdentifier(pools, poolIdentifier);

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
export function resolvePinnedCastTier(actor: SpellCostActorLike, spell: SpellLike): number | null {
	const tier = spell?.system?.tier ?? 0;
	if (tier <= 0) return null;

	const spellcasting = getClassSpellcasting(actor);
	if (!spellcasting?.castAtHighestTier) return null;

	const unlockedTier = actor?.system?.resources?.highestUnlockedSpellTier ?? 0;
	return Math.max(tier, unlockedTier);
}

/**
 * Builds the upcast selection a pinned cast tier implies, for the activation
 * paths that never open a dialog. Returns null when there is nothing to
 * synthesize: the spell does not scale, or the pinned tier adds no steps.
 *
 * A pinned tier at or below the spell's own tier is deliberately skipped. It
 * contributes no upcast steps, and for a spell whose tier sits above what the
 * caster has unlocked it would exceed the upcast tier bound, so the cast
 * resolves at its base tier instead of failing.
 */
export function synthesizePinnedUpcast(
	spell: SpellLike,
	pinnedCastTier: number | null,
): UpcastSelection | null {
	if (pinnedCastTier === null) return null;

	const baseTier = spell?.system?.tier ?? 0;
	if (baseTier <= 0) return null;
	if (pinnedCastTier <= baseTier) return null;

	const scalingMode = spell?.system?.scaling?.mode ?? 'none';
	if (scalingMode === 'none') return null;

	return {
		manaToSpend: pinnedCastTier,
		choiceIndex: scalingMode === 'upcastChoice' ? 0 : undefined,
	};
}

/**
 * Checks whether the actor can pay the resolved cost, without writing
 * anything. `overdrawn: true` means the pool cannot cover the cost but the
 * declared consequence permits the cast anyway; the caller decides whether
 * to confirm and proceed. With resource spending automation off, nothing is
 * validated and every cast is permitted.
 */
export function validateSpellCost(
	actor: SpellCostActorLike,
	cost: ResolvedSpellCost,
): SpellCostValidation {
	if (!isResourceSpendingAutomationEnabled()) return { ok: true, overdrawn: false };
	if (cost.type !== 'pool') return { ok: true, overdrawn: false };

	const pools = buildEffectiveChargePoolMap(asChargePoolActor(actor));
	const poolEntry = findChargePoolByIdentifier(pools, cost.poolIdentifier);
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
	actor: SpellCostActorLike,
	cost: ResolvedSpellCost,
): Promise<SpellCostValidation> {
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

	const pools = buildEffectiveChargePoolMap(asChargePoolActor(actor));
	const poolEntry = findChargePoolByIdentifier(pools, cost.poolIdentifier);
	if (!poolEntry) return validation;

	const previousValue = poolEntry.pool.current;
	poolEntry.pool.current = clampCurrentToMax(
		Math.max(0, previousValue - cost.amount),
		poolEntry.pool.max,
	);
	await persistChargePoolMap(asChargePoolActor(actor), pools);

	emitForCharacter(asChargePoolActor(actor), 'changed', {
		actor: asChargePoolActor(actor),
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
 * Renders a resolved cost as the short label the sheet and the cast dialog
 * both show. Returns null for a free cast so callers can omit the indicator.
 */
export function formatSpellCostLabel(cost: ResolvedSpellCost): string | null {
	if (cost.type === 'none') return null;
	if (cost.type === 'pool') return `${cost.amount} ${cost.poolLabel}`;
	if (cost.amount <= 0) return null;
	return localize('NIMBLE.ui.heroicActions.mana', { cost: String(cost.amount) });
}

/**
 * Computes the damage the declared overdraft consequence would deal, without
 * applying it. Used to tell the player what confirming will cost.
 */
export function previewOverdraftDamage(actor: SpellCostActorLike, cost: ResolvedSpellCost): number {
	if (cost.type !== 'pool' || cost.overdraftConsequence !== 'halfMaxHpDamage') return 0;
	return Math.floor((actor?.system?.attributes?.hp?.max ?? 0) / 2);
}

/**
 * Applies the declared overdraft consequence and returns the damage dealt.
 */
export async function applyOverdraftConsequence(
	actor: SpellCostActorLike,
	cost: ResolvedSpellCost,
): Promise<number> {
	const damage = previewOverdraftDamage(actor, cost);
	if (damage > 0) await actor.applyDamage?.(damage);
	return damage;
}
