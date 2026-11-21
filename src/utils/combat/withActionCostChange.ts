import type { ActionCostChange } from '#types/useOption.d.ts';

/**
 * The action cost after an option's change. A cut stops at the minimum and never raises a cost
 * that is already lower.
 */
export function withActionCostChange(cost: number, change: ActionCostChange | null): number {
	if (!change) return cost;
	if (change.delta >= 0) return cost + change.delta;
	return Math.max(Math.min(cost, change.minimum), cost + change.delta);
}
