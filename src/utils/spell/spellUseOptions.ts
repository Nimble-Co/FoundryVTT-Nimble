import type { ResourceCost } from '#types/resourceCost.d.ts';
import type {
	ActionCostChange,
	ChosenUseOption,
	CostChange,
	UseOption,
	UseOptionGroup,
} from '#types/useOption.d.ts';
import { rulesOfType } from '#utils/actor/actorRules.js';
import type { UseOptionRule } from '../../models/rules/useOption.js';
import {
	buildEffectiveChargePoolMap,
	findChargePoolByIdentifier,
	isCharacterActor,
} from '../chargePool/helpers.js';
import { hasRuleCharge } from '../chargePool/ruleChargeGate.js';
import { withCastMana } from '../cost/castManaCost.js';
import { settleResourceCost } from '../cost/resourceCost.js';

type OptionSpell = Parameters<UseOptionRule['appliesToSpell']>[0];

function optionOf(rule: UseOptionRule): UseOption {
	const key = rule.key;
	return {
		key,
		name: rule.resourceCost.source ?? '',
		cost: { ...rule.resourceCost, id: key },
		poolIdentifier: rule.poolIdentifier,
		actionCostChange: rule.actionCostChange,
		rangePerMana: Math.max(0, Math.trunc(Number(rule.rangePerMana) || 0)),
		cardNote: String(rule.cardNote ?? '').trim(),
		damageTypes: [...(rule.damageTypes as string[])],
		manaCostChange: rule.manaCostChange,
		freeCopy: rule.freeCopy === true,
	};
}

function poolLabel(actor: Actor | null | undefined, identifier: string): string {
	if (!isCharacterActor(actor)) return identifier;
	const entry = findChargePoolByIdentifier(buildEffectiveChargePoolMap(actor), identifier);
	return entry?.pool.label || identifier;
}

/**
 * The Spell or Attack Options the caster can turn on for this spell: options that share a
 * Charge Pool make one group named after the pool, and an option with no pool is a group of
 * its own.
 */
export function spellUseOptionGroups(
	actor: Actor | null | undefined,
	spell: OptionSpell,
): UseOptionGroup[] {
	const groups = new Map<string, UseOptionGroup>();
	const rules = rulesOfType(actor as { rules?: unknown } | null, 'useOption').filter(
		(rule) => rule.appliesTo() && rule.appliesToSpell(spell),
	);
	for (const rule of rules) {
		const option = optionOf(rule);
		const pool = option.poolIdentifier;
		const key = pool || option.key;
		const group = groups.get(key) ?? {
			key,
			label: pool ? poolLabel(actor, pool) : option.name,
			used: pool ? !hasRuleCharge(actor, pool) : false,
			options: [],
		};
		group.options.push(option);
		groups.set(key, group);
	}
	return [...groups.values()];
}

/** What the options the player turned on cost and change, with their amounts settled. */
export interface ChosenUseOptions {
	costs: ResourceCost[];
	/** The pools whose uses the options spend, one use each. */
	pools: Array<{ identifier: string; label: string }>;
	actionCostChanges: ActionCostChange[];
	/** Range the options add to the spell. */
	range: number;
	/** The lines the options put on the card. */
	notes: string[];
	/** The damage type the spell deals in place of its own, or '' for its own. */
	damageType: string;
	/** The name of the option that posts a free copy of the cast, or ''. */
	freeCopy: string;
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

/** How the options the player chose change the mana cost of the spell. */
export function chosenManaCostChanges(
	groups: readonly UseOptionGroup[],
	chosen: readonly ChosenUseOption[] = [],
): CostChange[] {
	return pickedOptions(groups, chosen).flatMap(({ option }) => option.manaCostChange ?? []);
}

/**
 * What the options the player chose cost and change. `castMana` is the mana the cast spends on
 * the spell, which a cost can read as `@castManaSpent`.
 */
export async function settleChosenUseOptions(
	actor: Actor | null | undefined,
	groups: readonly UseOptionGroup[],
	chosen: readonly ChosenUseOption[] = [],
	castMana = 0,
): Promise<ChosenUseOptions> {
	const settled = noChosenUseOptions();
	for (const { group, option, choice } of pickedOptions(groups, chosen)) {
		const cost = await settleResourceCost(
			actor as never,
			withCastMana(actor, option.cost, castMana),
			choice.amount,
		);
		if (Number(cost.amount) > 0) settled.costs.push(cost);
		if (option.poolIdentifier) {
			settled.pools.push({ identifier: option.poolIdentifier, label: group.label });
		}
		if (option.actionCostChange) settled.actionCostChanges.push(option.actionCostChange);
		settled.range += option.rangePerMana * Number(cost.amount);
		if (choice.pick && option.damageTypes.includes(choice.pick)) settled.damageType = choice.pick;
		if (option.cardNote) {
			settled.notes.push(option.cardNote.replaceAll('{amount}', String(cost.amount)));
		}
		if (option.freeCopy) settled.freeCopy = option.name;
	}
	return settled;
}
