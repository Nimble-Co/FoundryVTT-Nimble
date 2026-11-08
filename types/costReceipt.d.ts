import type { PaidUseCost, UseCost } from '#types/useCost.d.ts';

/** What one use paid, kept to give it back later. */
export interface CostReceipt {
	cost: UseCost;
	paid: PaidUseCost;
}
