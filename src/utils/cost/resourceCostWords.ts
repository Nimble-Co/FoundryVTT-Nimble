import type { CardResourceCost, ResourceCost, ResourceCostKind } from '#types/resourceCost.d.ts';
import localize from '../localize.js';

/** "3 mana", "14 HP", "10 temp HP", "1 Wound". */
function resourceCostText(kind: ResourceCostKind, amount: number): string {
	const key = kind === 'wounds' ? (amount === 1 ? 'wound' : 'wounds') : kind;
	return localize(`NIMBLE.resourceCosts.card.${key}`, { amount: String(amount) });
}

/** "Cost: 3 mana (Storm Wake)". */
function cardCostLine(cost: CardResourceCost): string {
	return localize('NIMBLE.resourceCosts.cardLine', {
		cost: resourceCostText(cost.kind, cost.amount),
		source: cost.source,
	});
}

/** The words of the roll window spend line: what the use spends, and what it sacrifices. */
function rollWindowCostParts(costs: readonly ResourceCost[]): {
	spends: string[];
	sacrifices: string[];
} {
	const spends: string[] = [];
	const sacrifices: string[] = [];
	for (const cost of costs) {
		const amount = Number(cost.amount);
		if (cost.kind === 'mana') {
			spends.push(localize('NIMBLE.resourceCosts.dialog.mana', { amount: String(amount) }));
		} else if (cost.kind === 'tempHp') {
			spends.push(resourceCostText(cost.kind, amount));
		} else {
			sacrifices.push(resourceCostText(cost.kind, amount));
		}
	}
	return { spends, sacrifices };
}

/** The card record of a use's costs. */
function cardCostsOf(costs: readonly ResourceCost[]): CardResourceCost[] {
	return costs.map((cost) => ({
		kind: cost.kind,
		amount: Number(cost.amount),
		source: cost.source ?? '',
	}));
}

export { cardCostLine, cardCostsOf, resourceCostText, rollWindowCostParts };
