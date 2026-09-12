import type {
	ClassSpellcastingDeclaration,
	ResolvedSpellCost,
	SpellCostActorLike,
	SpellLike,
	UpcastSelection,
} from '#types/spellCost.d.ts';
import {
	buildEffectiveChargePoolMap,
	findChargePoolByIdentifier,
	resolveFormulaToInteger,
} from '../chargePool/helpers.js';
import type { ChargePoolMap } from '../chargePool/types.js';
import localize from '../localize.js';
import { asChargePoolActor } from './asChargePoolActor.js';

function declaresSpellcasting(spellcasting: ClassSpellcastingDeclaration | undefined): boolean {
	if (!spellcasting) return false;
	const poolIdentifier = spellcasting.cost?.poolIdentifier?.trim() ?? '';
	return poolIdentifier.length > 0 || spellcasting.castAtHighestTier === true;
}

/** Whether the character holds mana at all, so a mana cost can be paid. */
function hasManaCapacity(actor: SpellCostActorLike): boolean {
	const mana = actor?.system?.resources?.mana;
	return Math.max(mana?.max ?? 0, mana?.baseMax ?? 0) > 0;
}

type DeclaringClass = { identifier: string; spellcasting: ClassSpellcastingDeclaration };

type ClassItemLike = NonNullable<NonNullable<SpellCostActorLike['items']>['contents']>[number];

/** The key `levels.classes` uses: the document getter, which falls back to the name slug. */
function classIdentifier(item: ClassItemLike): string {
	return item.identifier || (item.system as { identifier?: string } | undefined)?.identifier || '';
}

/**
 * The class whose spellcasting declaration governs this cast, or null for the
 * default rule that a tiered spell costs its tier in mana.
 *
 * The declaration belongs to a class, so a character with more than one class
 * must not pay one class's cost for another class's spell. Attribution runs in
 * two steps: the spell's own class restriction when it has one, then the
 * character's single class when they have only one.
 *
 * Known limitation: most authored spells carry no class restriction, so a
 * multiclass character casting an unattributable spell falls back to mana
 * rather than guessing which class to charge. Attributing a spell by the school
 * that granted it would resolve this and is not built.
 */
function getDeclaringClass(actor: SpellCostActorLike, spell: SpellLike): DeclaringClass | null {
	const classItems = (actor?.items?.contents ?? []).filter((item) => item.type === 'class');
	if (classItems.length < 1) return null;

	const restrictedTo = (spell?.system?.classes ?? []).filter((identifier) => identifier.length > 0);

	const candidates =
		restrictedTo.length > 0
			? classItems.filter((item) => restrictedTo.includes(classIdentifier(item)))
			: classItems;

	const declared = candidates
		.map((item) => ({
			identifier: classIdentifier(item),
			spellcasting: (item.system as { spellcasting?: ClassSpellcastingDeclaration } | undefined)
				?.spellcasting,
		}))
		.filter((entry): entry is DeclaringClass => declaresSpellcasting(entry.spellcasting));

	if (declared.length < 1) return null;

	// More than one declared cost cannot name which pool pays, so the cast falls
	// back to mana. Two pool classes and no mana would then pay nothing, an
	// unshipped combination.
	if (declared.length > 1) return null;

	// With no restriction to narrow by, a single class is unambiguous and more
	// than one is not. Mana is the safe default for the ambiguous case, but only
	// for a character who holds mana: one who holds none would pay nothing at
	// all, so the single declared cost is read as the only thing that could be
	// paying for the cast.
	if (restrictedTo.length < 1 && classItems.length > 1 && hasManaCapacity(actor)) return null;

	return declared[0];
}

type SpellCostOptions = { castTier?: number };

/**
 * Builds a cost resolver bound to one actor. The charge-pool map and each
 * evaluated amount formula are computed once and shared across every spell
 * the resolver is asked about, so labelling a whole spell list costs the same
 * as labelling one spell. Build a fresh resolver per render; it does not
 * observe later changes to the actor.
 */
export function createSpellCostResolver(
	actor: SpellCostActorLike,
): (spell: SpellLike, options?: SpellCostOptions) => ResolvedSpellCost {
	let pools: ChargePoolMap | null = null;
	const amountsByFormula = new Map<string, number>();

	return (spell, { castTier }: SpellCostOptions = {}) => {
		const tier = spell?.system?.tier ?? 0;
		if (tier <= 0) return { type: 'none' };

		const declaring = getDeclaringClass(actor, spell);
		const spellcasting = declaring?.spellcasting;
		const poolIdentifier = spellcasting?.cost?.poolIdentifier?.trim() ?? '';
		if (poolIdentifier.length === 0) return { type: 'mana', amount: castTier ?? tier };

		const formula = spellcasting?.cost?.amount ?? '1';
		let amount = amountsByFormula.get(formula);
		if (amount === undefined) {
			amount = Math.max(0, resolveFormulaToInteger(asChargePoolActor(actor), formula));
			amountsByFormula.set(formula, amount);
		}
		pools ??= buildEffectiveChargePoolMap(asChargePoolActor(actor));
		const poolEntry = findChargePoolByIdentifier(pools, poolIdentifier);

		// Past the declared level bound the consequence is not applied: the rule
		// that replaces it is not automated, so the overdraw is still offered and
		// its cost is settled at the table. The bound counts levels in the
		// declaring class, so levels in another class do not move it.
		const overdraftMaxLevel = spellcasting?.cost?.overdraftMaxLevel ?? null;
		const classLevel = actor?.levels?.classes?.[declaring?.identifier ?? ''] ?? 0;
		const overdraftResolvedAtTable =
			typeof overdraftMaxLevel === 'number' && classLevel > overdraftMaxLevel;

		return {
			type: 'pool',
			poolIdentifier,
			poolLabel: poolEntry?.pool.label ?? poolIdentifier,
			amount,
			overdraftConsequence: spellcasting?.cost?.overdraftConsequence ?? '',
			overdraftResolvedAtTable,
		};
	};
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
	options: SpellCostOptions = {},
): ResolvedSpellCost {
	return createSpellCostResolver(actor)(spell, options);
}

/**
 * Resolves the tier a spell is cast at when the actor's class declares that
 * its spells always resolve at the highest unlocked tier. Returns null when
 * no class pins the tier, leaving the cast tier a player choice.
 */
export function resolvePinnedCastTier(actor: SpellCostActorLike, spell: SpellLike): number | null {
	const tier = spell?.system?.tier ?? 0;
	if (tier <= 0) return null;

	if (!getDeclaringClass(actor, spell)?.spellcasting.castAtHighestTier) return null;

	const unlockedTier = actor?.system?.resources?.highestUnlockedSpellTier ?? 0;
	return Math.max(tier, unlockedTier);
}

/**
 * Whether the spell's own tier sits above what the caster has unlocked.
 *
 * The tier control only exists for a spell that scales, so this is the bound
 * for every other cast: a spell that does not scale, a class that pins the
 * tier, or a macro. An actor with no tier ladder, such as a monster, casts at
 * the spell's own tier and is never bounded, matching computeUpcastBounds.
 */
export function exceedsUnlockedSpellTier(actor: SpellCostActorLike, spell: SpellLike): boolean {
	const tier = spell?.system?.tier ?? 0;
	if (tier <= 0) return false;

	const unlockedTier = actor?.system?.resources?.highestUnlockedSpellTier;
	if (unlockedTier === null || unlockedTier === undefined) return false;

	return tier > unlockedTier;
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
 * The tier a pinned cast actually resolves at, for labelling. A pinned tier
 * only lifts a spell that scales to it; a spell that does not scale casts
 * and is charged at its own tier, so null is returned for it.
 */
export function resolveEffectiveCastTier(
	spell: SpellLike,
	pinnedCastTier: number | null,
): number | null {
	return synthesizePinnedUpcast(spell, pinnedCastTier) ? pinnedCastTier : null;
}

/**
 * Renders a resolved cost as the short label the sheet and the cast dialog
 * both show. Returns null for a free cast so callers can omit the indicator.
 */
export function formatSpellCostLabel(cost: ResolvedSpellCost): string | null {
	if (cost.type === 'none') return null;
	if (cost.type === 'pool') {
		return localize('NIMBLE.ui.heroicActions.poolCost', {
			cost: String(cost.amount),
			pool: cost.poolLabel,
		});
	}
	if (cost.amount <= 0) return null;
	return localize('NIMBLE.ui.heroicActions.mana', { cost: String(cost.amount) });
}

/**
 * Computes the damage the declared overdraft consequence would deal, without
 * applying it. Used to tell the player what confirming will cost.
 */
export function previewOverdraftDamage(actor: SpellCostActorLike, cost: ResolvedSpellCost): number {
	if (cost.type !== 'pool' || cost.overdraftConsequence !== 'halfMaxHpDamage') return 0;
	if (cost.overdraftResolvedAtTable) return 0;
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
