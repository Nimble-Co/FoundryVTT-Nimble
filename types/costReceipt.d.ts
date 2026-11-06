import type { PaidRerollCost, RerollCost } from '#utils/reroll/rerollCost.ts';

/** What one use paid, kept to give it back later. */
export interface CostReceipt {
	cost: RerollCost;
	paid: PaidRerollCost;
}
