import type { ResourceCost } from '#types/resourceCost.d.ts';
import type { CostPayer } from '#types/useCost.d.ts';
import type { ResourceCostRule } from '../../models/rules/resourceCost.js';
import localize from '../localize.js';
import { canSpendResource, manaOf, tempHpOf, woundsOf } from './resourceCost.js';
import { resourceCostText } from './resourceCostWords.js';

interface ItemWithRules {
	rules?: Map<string, { type: string; disabled?: boolean }>;
}

/** The Spend or Sacrifice costs of one use of the item. A use free of mana leaves out its mana. */
function resourceCostsOfUse(
	item: ItemWithRules,
	{ freeOfMana = false }: { freeOfMana?: boolean } = {},
): ResourceCost[] {
	return [...(item.rules?.values() ?? [])]
		.filter((rule): rule is ResourceCostRule => rule.type === 'resourceCost' && !rule.disabled)
		.filter((rule) => rule.appliesTo())
		.map((rule) => rule.resourceCost)
		.filter((cost) => Number(cost.amount) > 0 && !(freeOfMana && cost.kind === 'mana'));
}

function notEnoughNotice(actor: CostPayer, cost: ResourceCost): string {
	const source = cost.source ?? '';
	const amount = Number(cost.amount);
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

export { resourceCostRefusal, resourceCostsOfUse };
