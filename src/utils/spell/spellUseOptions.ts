import type { ResourceCost } from '#types/resourceCost.d.ts';
import type {
	ActionCostChange,
	ChosenUseOption,
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
}

/** The options the player chose, at most one in each group, read against the groups offered. */
export async function settleChosenUseOptions(
	actor: Actor | null | undefined,
	groups: readonly UseOptionGroup[],
	chosen: readonly ChosenUseOption[] = [],
): Promise<ChosenUseOptions> {
	const settled: ChosenUseOptions = { costs: [], pools: [], actionCostChanges: [] };
	for (const group of groups) {
		const choice = chosen.find((each) => group.options.some((option) => option.key === each.key));
		const option = group.options.find((each) => each.key === choice?.key);
		if (!option) continue;
		const cost = await settleResourceCost(actor as never, option.cost, choice?.amount);
		if (Number(cost.amount) > 0) settled.costs.push(cost);
		if (option.poolIdentifier) {
			settled.pools.push({ identifier: option.poolIdentifier, label: group.label });
		}
		if (option.actionCostChange) settled.actionCostChanges.push(option.actionCostChange);
	}
	return settled;
}
