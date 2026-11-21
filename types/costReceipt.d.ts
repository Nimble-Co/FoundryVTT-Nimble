import type { ResourceCost } from '#types/resourceCost.d.ts';
import type { PaidUseCost, UseCost } from '#types/useCost.d.ts';

/** What one use paid, kept to give it back later. */
export interface CostReceipt {
	cost: UseCost;
	paid: PaidUseCost;
}

/** The costs a use spent or sacrificed. */
export interface CostsSpent {
	/** The costs as the use took them. With Resource Spending off, the amounts the use needed. */
	taken: ResourceCost[];
	/** The costs that went beyond what the creature had, whose consequences still apply. */
	beyond: ResourceCost[];
}

/** What an item use spent: the receipts to give back, and the costs as taken, for the card. */
export interface UseSpend extends CostsSpent {
	receipts: CostReceipt[];
}
