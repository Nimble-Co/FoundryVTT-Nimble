import type { ConditionalDamage } from '#types/conditionalDamage.d.ts';
import type { ResolvedSpellCost, SpellCostActorLike, SpellLike } from '#types/spellCost.d.ts';
import type { ChosenUseOption, UseOptionGroup } from '#types/useOption.d.ts';
import type { UseOptionRule } from '../../models/rules/useOption.js';
import { exceedsUnlockedSpellTier } from '../../utils/spell/spellCost.js';
import {
	type CastCostChange,
	type ChosenUseOptions,
	settleChosenUseOptions,
	spellManaWithOptions,
} from '../../utils/spell/spellUseOptions.js';
import { useOptionGroups } from '../../utils/useOption/useOptionGroups.js';
import { applyUseOptionChanges } from './applyUseOptionChanges.js';
import { pickRidersOf, withPickAmounts } from './useOptionPicks.js';

type OptionItem = { type?: string } & Parameters<UseOptionRule['appliesToSpell']>[0] &
	Parameters<UseOptionRule['appliesToWeapon']>[0];

/**
 * The Spell or Attack Options the actor can turn on for this item. A spell has them only at a
 * tier the caster has unlocked.
 */
export function useOptionGroupsOfItem(
	actor: Actor | null | undefined,
	item: unknown,
): UseOptionGroup[] {
	const target = item as OptionItem;
	if (target?.type === 'spell') {
		if (exceedsUnlockedSpellTier(actor as SpellCostActorLike, target as SpellLike)) return [];
		return useOptionGroups(actor, (rule) => rule.appliesToSpell(target));
	}
	if (target?.type === 'object') {
		return useOptionGroups(actor, (rule) => rule.appliesToWeapon(target));
	}
	return [];
}

/** Whether an option the dialog of this spell offers can change the actions the use costs. */
export function offersActionCostChange(actor: Actor | null | undefined, item: unknown): boolean {
	if ((item as OptionItem)?.type !== 'spell') return false;
	return useOptionGroupsOfItem(actor, item).some((group) =>
		group.options.some((option) => option.actionCostChange !== null),
	);
}

/** What the use spends and gets from the picks of the chosen split options. */
interface PickChoices {
	useOptions?: ChosenUseOption[];
	conditionalDamages?: ConditionalDamage[];
}

/**
 * Keep the picks of each chosen split option in range and add their damage to the choices.
 * Returns the steps the picks lower the target's armor.
 */
export function addPickRiders(
	actor: Actor | null | undefined,
	groups: readonly UseOptionGroup[],
	choices: PickChoices,
): number {
	choices.useOptions = withPickAmounts(actor as never, groups, choices.useOptions);
	const riders = pickRidersOf(groups, choices.useOptions);
	if (riders.damages.length > 0) {
		choices.conditionalDamages = [...(choices.conditionalDamages ?? []), ...riders.damages];
	}
	return riders.lowerArmorSteps;
}

/**
 * The mana cost of the cast with less mana, the Spell Mana Cost change and the chosen options. A
 * cast the change makes cost no mana is free.
 */
export function spellCostWithOptions(
	spellCost: ResolvedSpellCost | null,
	change: CastCostChange & { manaCostChange: number; lessMana?: boolean },
	wholeCastFree: boolean,
): ResolvedSpellCost | null {
	if (spellCost?.type !== 'mana') return spellCost;
	if (wholeCastFree) return { type: 'none' };
	const amount = spellManaWithOptions(spellCost.amount, change);
	return amount === 0 && change.manaCostChange !== 0 ? { type: 'none' } : { ...spellCost, amount };
}

/**
 * Settle what the chosen options cost and put their changes into the activation. Null, with a
 * notice, when the cost of an option cannot be worked out.
 */
export async function settleUseOptions(
	actor: Actor | null | undefined,
	groups: readonly UseOptionGroup[],
	chosen: readonly ChosenUseOption[] | undefined,
	castMana: number,
	activation: Parameters<typeof applyUseOptionChanges>[0],
): Promise<ChosenUseOptions | null> {
	const settled = await settleChosenUseOptions(actor, groups, chosen, castMana);
	if (settled) applyUseOptionChanges(activation, settled);
	return settled;
}
