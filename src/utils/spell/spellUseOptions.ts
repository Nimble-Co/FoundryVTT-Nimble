import type { ResourceCost } from '#types/resourceCost.d.ts';
import type { SpellCostActorLike, SpellLike } from '#types/spellCost.d.ts';
import type {
	ActionCostChange,
	ChosenUseOption,
	CostChange,
	PoolUse,
	UseOption,
	UseOptionEffect,
	UseOptionGroup,
} from '#types/useOption.d.ts';
import type { UseOptionRule } from '../../models/rules/useOption.js';
import { withActionCostChange } from '../combat/withActionCostChange.js';
import { castManaCostOf } from '../cost/castManaCost.js';
import { settleResourceCost } from '../cost/resourceCost.js';
import { exceedsUnlockedSpellTier } from './spellCost.js';
import { useOptionGroups } from '../useOption/useOptionGroups.js';

type OptionSpell = Parameters<UseOptionRule['appliesToSpell']>[0];

/** The Spell or Attack Options the caster can turn on for this spell. */
export function spellUseOptionGroups(
	actor: Actor | null | undefined,
	spell: OptionSpell,
): UseOptionGroup[] {
	if (exceedsUnlockedSpellTier(actor as SpellCostActorLike, spell as SpellLike)) return [];
	return useOptionGroups(actor, (rule) => rule.appliesToSpell(spell));
}

/** Whether an option the dialog of this item offers can change the actions the use costs. */
export function offersActionCostChange(actor: Actor | null | undefined, item: unknown): boolean {
	const spell = item as OptionSpell;
	if (spell?.type !== 'spell') return false;
	return spellUseOptionGroups(actor, spell).some((group) =>
		group.options.some((option) => option.actionCostChange !== null),
	);
}

/** What the options the player turned on cost and change, with their amounts settled. */
export interface ChosenUseOptions {
	costs: ResourceCost[];
	/** The pools whose uses the options spend, one use each. */
	pools: PoolUse[];
	actionCostChanges: ActionCostChange[];
	/** Range the options add to the spell. */
	range: number;
	/** The lines the options put on the card. */
	notes: string[];
	/** The damage type the spell deals in place of its own, or '' for its own. */
	damageType: string;
	/** The name of the option that posts a free copy of the cast, or ''. */
	freeCopy: string;
	/** The effects the caster gains after the cast. */
	effects: UseOptionEffect[];
}

/** What a use with no option turned on costs and changes: nothing. */
export function noChosenUseOptions(): ChosenUseOptions {
	return {
		costs: [],
		pools: [],
		actionCostChanges: [],
		range: 0,
		notes: [],
		damageType: '',
		freeCopy: '',
		effects: [],
	};
}

/** The options the player chose, at most one in each group, read against the groups offered. */
function pickedOptions(
	groups: readonly UseOptionGroup[],
	chosen: readonly ChosenUseOption[],
): Array<{ group: UseOptionGroup; option: UseOption; choice: ChosenUseOption }> {
	return groups.flatMap((group) => {
		const choice = chosen.find((each) => group.options.some((option) => option.key === each.key));
		const option = group.options.find((each) => each.key === choice?.key);
		return option && choice ? [{ group, option, choice }] : [];
	});
}

/** How the options the player chose change what the spell itself costs. */
export interface CastCostChange {
	/** An option's cost takes the place of the spell's cost. */
	replacesSpellCost: boolean;
	/** The mana the spell costs at its own tier, or null for no change. */
	manaSet: number | null;
	/** How the options change the mana cost of the spell. */
	manaCostChanges: CostChange[];
}

/**
 * The mana of the spell at its tier mana `mana`, in the order the cast spends it: less mana takes
 * 1 first, then a set mana is final, else each change of the chosen options applies. A cast that
 * costs no mana stays free.
 */
export function spellManaWithOptions(
	mana: number,
	change: Pick<CastCostChange, 'manaSet' | 'manaCostChanges'> & { lessMana?: boolean },
): number {
	const left = change.lessMana && mana > 0 ? mana - 1 : mana;
	if (left <= 0) return 0;
	if (change.manaSet !== null) return change.manaSet;
	return change.manaCostChanges.reduce(withActionCostChange, left);
}

export function chosenCastCostChange(
	groups: readonly UseOptionGroup[],
	chosen: readonly ChosenUseOption[] = [],
): CastCostChange {
	const picked = pickedOptions(groups, chosen).map(({ option }) => option);
	const set = picked.find((option) => option.manaSet !== null);
	return {
		replacesSpellCost: picked.some((option) => option.replacesSpellCost),
		manaSet: set?.manaSet ?? null,
		manaCostChanges: picked.flatMap((option) => option.manaCostChange ?? []),
	};
}

/**
 * What the options the player chose cost and change. `castMana` is the mana the cast spends on
 * the spell, which a cost can read as `@castManaSpent`. Null, with a notice, when the cost of an
 * option cannot be worked out.
 */
export async function settleChosenUseOptions(
	actor: Actor | null | undefined,
	groups: readonly UseOptionGroup[],
	chosen: readonly ChosenUseOption[] = [],
	castMana = 0,
): Promise<ChosenUseOptions | null> {
	const settled = noChosenUseOptions();
	for (const { group, option, choice } of pickedOptions(groups, chosen)) {
		const castCost = castManaCostOf(actor, option.cost, castMana);
		if (!castCost) {
			ui.notifications?.error(localize('NIMBLE.useOptions.badCostFormula', { name: option.name }));
			return null;
		}
		const cost = await settleResourceCost(actor as never, castCost, choice.amount);
		if (Number(cost.amount) > 0) settled.costs.push(cost);
		if (option.chargePoolIdentifier) {
			settled.pools.push({ identifier: option.chargePoolIdentifier, label: group.label });
		}
		if (option.actionCostChange) settled.actionCostChanges.push(option.actionCostChange);
		settled.range += option.rangePerMana * Number(cost.amount);
		if (choice.damageType && option.damageTypes.includes(choice.damageType)) {
			settled.damageType = choice.damageType;
		}
		if (option.cardNote) {
			settled.notes.push(option.cardNote.replaceAll('{amount}', String(cost.amount)));
		}
		if (option.freeCopy) settled.freeCopy = option.name;
		if (option.effect) settled.effects.push(option.effect);
	}
	return settled;
}
