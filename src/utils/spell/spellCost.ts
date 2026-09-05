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
	return (mana?.max ?? mana?.baseMax ?? 0) > 0;
}

/**
 * The spellcasting declaration that governs this cast, or null for the default
 * rule that a tiered spell costs its tier in mana.
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
function getClassSpellcasting(
	actor: SpellCostActorLike,
	spell: SpellLike,
): ClassSpellcastingDeclaration | null {
	const classItems = (actor?.items?.contents ?? []).filter((item) => item.type === 'class');
	if (classItems.length < 1) return null;

	const restrictedTo = (spell?.system?.classes ?? []).filter((identifier) => identifier.length > 0);

	const candidates =
		restrictedTo.length > 0
			? classItems.filter((item) =>
					restrictedTo.includes(
						(item.system as { identifier?: string } | undefined)?.identifier ?? '',
					),
				)
			: classItems;

	const declared = candidates
		.map(
			(item) =>
				(item.system as { spellcasting?: ClassSpellcastingDeclaration } | undefined)?.spellcasting,
		)
		.filter((spellcasting): spellcasting is ClassSpellcastingDeclaration =>
			declaresSpellcasting(spellcasting),
		);

	if (declared.length < 1) return null;

	// With no restriction to narrow by, a single class is unambiguous and more
	// than one is not. Mana is the safe default for the ambiguous case, but only
	// for a character who holds mana: one who holds none would pay nothing at
	// all, so a single declared cost is read as the only thing that could be
	// paying for the cast.
	if (restrictedTo.length < 1 && classItems.length > 1) {
		if (declared.length > 1 || hasManaCapacity(actor)) return null;
	}

	return declared[0];
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

	const spellcasting = getClassSpellcasting(actor, spell);
	const poolIdentifier = spellcasting?.cost?.poolIdentifier?.trim() ?? '';
	if (poolIdentifier.length === 0) return { type: 'mana', amount: castTier ?? tier };

	const amount = Math.max(
		0,
		resolveFormulaToInteger(asChargePoolActor(actor), spellcasting?.cost?.amount ?? '1'),
	);
	const pools = buildEffectiveChargePoolMap(asChargePoolActor(actor));
	const poolEntry = findChargePoolByIdentifier(pools, poolIdentifier);

	// Past the declared level bound the consequence is not applied: the rule
	// that replaces it is not automated, so the overdraw is still offered and
	// its cost is settled at the table.
	const overdraftMaxLevel = spellcasting?.cost?.overdraftMaxLevel ?? null;
	const characterLevel = actor?.levels?.character ?? 0;
	const overdraftResolvedAtTable =
		typeof overdraftMaxLevel === 'number' && characterLevel > overdraftMaxLevel;

	return {
		type: 'pool',
		poolIdentifier,
		poolLabel: poolEntry?.pool.label ?? poolIdentifier,
		amount,
		overdraftConsequence: spellcasting?.cost?.overdraftConsequence ?? '',
		overdraftResolvedAtTable,
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

	const spellcasting = getClassSpellcasting(actor, spell);
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
