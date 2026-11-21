import type { CardResourceCost, ResourceCost, ResourceCostKind } from '#types/resourceCost.d.ts';
import localize from '../localize.js';

/** "3 mana", "14 HP", "10 temp HP", "1 Wound", "1d4 Wounds". */
function resourceCostText(kind: ResourceCostKind, amount: number | string): string {
	const key = kind === 'wounds' ? (amount === 1 ? 'wound' : 'wounds') : kind;
	return localize(`NIMBLE.resourceCosts.card.${key}`, { amount: String(amount) });
}

/** "Wound" for 1, else "Wounds". */
function woundsWord(count: number): string {
	return localize(`NIMBLE.resourceCosts.${count === 1 ? 'woundWord' : 'woundsWord'}`);
}

/** "Cost: 3 mana (<source>)". A rolled cost shows the amount it rolled. */
function cardCostLine(cost: CardResourceCost): string {
	return localize('NIMBLE.resourceCosts.cardLine', {
		cost: resourceCostText(cost.kind, cost.amount),
		source: cost.source,
	});
}

/** A rolled amount before its roll reads as the roll, such as "1d4". */
function amountText(cost: ResourceCost): number | string {
	const amount = Number(cost.amount);
	return Number.isFinite(amount) ? amount : String(cost.amount);
}

/** The words of the roll window spend line: what the use spends, and what it sacrifices. */
function rollWindowCostParts(costs: readonly ResourceCost[]): {
	spends: string[];
	sacrifices: string[];
} {
	const spends: string[] = [];
	const sacrifices: string[] = [];
	for (const cost of costs) {
		const amount = amountText(cost);
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

/** The card record of a use's costs. A cost that took nothing has no line. */
function cardCostsOf(costs: readonly ResourceCost[]): CardResourceCost[] {
	return costs
		.filter((cost) => Number(cost.amount) > 0)
		.map((cost) => ({
			kind: cost.kind,
			amount: Number(cost.amount),
			source: cost.source ?? '',
			...(cost.roll ? { roll: cost.roll } : {}),
		}));
}

export { cardCostLine, cardCostsOf, resourceCostText, rollWindowCostParts, woundsWord };
