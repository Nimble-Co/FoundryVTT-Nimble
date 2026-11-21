import type { ResourceCost, ResourceCostRollData } from '#types/resourceCost.d.ts';
import type { CostPayer } from '#types/useCost.d.ts';
import type { ResourceCostRule } from '../../models/rules/resourceCost.js';
import localize from '../localize.js';
import {
	canSpendResource,
	isRolledCost,
	lowestAmountOf,
	resourceKind,
	settleResourceCost,
	usedBefore,
} from './resourceCost.js';
import { resourceCostText, woundsWord } from './resourceCostWords.js';

interface ItemWithRules {
	rules?: ReadonlyMap<string, { type: string; disabled?: boolean }>;
}

function resourceCostRules(item: ItemWithRules): ResourceCostRule[] {
	return [...(item.rules?.values() ?? [])].filter(
		(rule): rule is ResourceCostRule => rule.type === 'resourceCost' && !rule.disabled,
	);
}

/** Whether the item has a Spend or Sacrifice rule, so its formulas can read `@cost`. */
function hasResourceCostRules(item: ItemWithRules): boolean {
	return resourceCostRules(item).length > 0;
}

/** The Spend or Sacrifice costs of one use of the item. A use free of mana leaves out its mana. */
function resourceCostsOfUse(
	item: ItemWithRules,
	{ freeOfMana = false }: { freeOfMana?: boolean } = {},
): ResourceCost[] {
	return resourceCostRules(item)
		.filter((rule) => rule.appliesTo())
		.map((rule) => rule.resourceCost)
		.filter(
			(cost) =>
				(cost.spend.mode === 'variable' || isRolledCost(cost) || Number(cost.amount) > 0) &&
				!(freeOfMana && cost.kind === 'mana'),
		);
}

/**
 * The costs with their amounts fixed for this use: the amounts the player chose, keyed by the
 * cost's id, and the rolls rolled now.
 */
async function settleResourceCosts(
	actor: CostPayer,
	costs: readonly ResourceCost[],
	chosen: Record<string, number> = {},
): Promise<ResourceCost[]> {
	const settled: ResourceCost[] = [];
	for (const cost of costs) {
		settled.push(await settleResourceCost(actor, cost, cost.id ? chosen[cost.id] : undefined));
	}
	return settled;
}

/** What the use spends or sacrifices of each kind, for `@cost.mana` and the others. */
function resourceCostRollData(
	costs: ReadonlyArray<Pick<ResourceCost, 'kind' | 'amount'>>,
): ResourceCostRollData {
	const totals: ResourceCostRollData = { mana: 0, hp: 0, tempHp: 0, wounds: 0 };
	for (const cost of costs) totals[cost.kind] += Math.max(0, Number(cost.amount) || 0);
	return totals;
}

function notEnoughNotice(
	actor: CostPayer,
	cost: ResourceCost,
	available = resourceKind(cost.kind).have(actor),
): string {
	const amount = lowestAmountOf(actor, cost) ?? 0;
	return localize(resourceKind(cost.kind).notEnoughKey, {
		source: cost.source ?? '',
		amount: String(amount),
		cost: resourceCostText(cost.kind, amount),
		wounds: woundsWord(amount),
		available: String(available),
	});
}

/**
 * The notice for the first cost the creature cannot cover, or null when it covers them all. Each
 * cost is checked against what is left after the costs before it.
 */
function resourceCostRefusal(actor: CostPayer, costs: readonly ResourceCost[]): string | null {
	const used = usedBefore(costs, (cost) => lowestAmountOf(actor, cost) ?? 0);
	const index = costs.findIndex((cost, each) => !canSpendResource(actor, cost, used[each]));
	if (index < 0) return null;
	const short = costs[index];
	return notEnoughNotice(
		actor,
		short,
		Math.max(0, resourceKind(short.kind).have(actor) - used[index]),
	);
}

/** Show the notice for the first cost the creature cannot cover. True when there is one. */
function refuseResourceCosts(actor: CostPayer, costs: readonly ResourceCost[]): boolean {
	const refusal = resourceCostRefusal(actor, costs);
	if (refusal) ui.notifications?.error(refusal);
	return refusal !== null;
}

export {
	hasResourceCostRules,
	refuseResourceCosts,
	resourceCostRefusal,
	resourceCostRollData,
	resourceCostsOfUse,
	settleResourceCosts,
};
