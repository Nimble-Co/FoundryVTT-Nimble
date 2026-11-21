import type { ResourceCost, ResourceCostRollData } from '#types/resourceCost.d.ts';
import type { CostPayer } from '#types/useCost.d.ts';
import type { ResourceCostRule } from '../../models/rules/resourceCost.js';
import localize from '../localize.js';
import {
	canSpendResource,
	isRolledCost,
	lowestAmountOf,
	manaOf,
	settleResourceCost,
	tempHpOf,
	woundsOf,
} from './resourceCost.js';
import { resourceCostText } from './resourceCostWords.js';

interface ItemWithRules {
	rules?: Map<string, { type: string; disabled?: boolean }>;
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
function resourceCostRollData(costs: readonly ResourceCost[]): ResourceCostRollData {
	const totals: ResourceCostRollData = { mana: 0, hp: 0, tempHp: 0, wounds: 0 };
	for (const cost of costs) totals[cost.kind] += Math.max(0, Number(cost.amount) || 0);
	return totals;
}

function notEnoughNotice(actor: CostPayer, cost: ResourceCost): string {
	const source = cost.source ?? '';
	const amount = lowestAmountOf(actor, cost) ?? 0;
	switch (cost.kind) {
		case 'hp':
			return localize('NIMBLE.resourceCosts.notEnoughHp', { source, amount: String(amount) });
		case 'wounds': {
			const wounds = woundsOf(actor);
			return localize('NIMBLE.resourceCosts.notEnoughWoundRoom', {
				source,
				amount: String(amount),
				wounds: localize(`NIMBLE.resourceCosts.${amount === 1 ? 'woundWord' : 'woundsWord'}`),
				available: String(Math.max(0, (wounds?.max ?? 0) - (wounds?.value ?? 0))),
			});
		}
		case 'mana':
		case 'tempHp':
			return localize('NIMBLE.resourceCosts.notEnough', {
				source,
				cost: resourceCostText(cost.kind, amount),
				available: String(cost.kind === 'mana' ? manaOf(actor) : tempHpOf(actor)),
			});
	}
}

/** The notice for the first cost the creature cannot cover, or null when it covers them all. */
function resourceCostRefusal(actor: CostPayer, costs: readonly ResourceCost[]): string | null {
	const short = costs.find((cost) => !canSpendResource(actor, cost));
	return short ? notEnoughNotice(actor, short) : null;
}

export {
	hasResourceCostRules,
	resourceCostRefusal,
	resourceCostRollData,
	resourceCostsOfUse,
	settleResourceCosts,
};
