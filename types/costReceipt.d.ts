import type { PaidUseCost, UseCost } from '#utils/cost/useCost.ts';

/** What one use paid, kept to give it back later. */
export interface CostReceipt {
	cost: UseCost;
	paid: PaidUseCost;
}
