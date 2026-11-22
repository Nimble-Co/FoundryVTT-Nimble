import { isResourceSpendingAutomationEnabled } from '../../settings/automationSettings.js';
import { adjustPool } from './chargePoolRecover.js';
import { getPools } from './chargePoolSync.js';
import type { ChargeConsumptionDetail } from './types.js';

export interface ChosenChargeSpend {
	poolId: string;
	count: number;
}

/**
 * Takes the charges that the roll window spent from their pools, and says what each pool lost.
 * With spending automation off, the pools stay for the table to count.
 */
export async function spendChosenCharges(
	actor: Actor.Implementation | null | undefined,
	spends: readonly ChosenChargeSpend[],
): Promise<ChargeConsumptionDetail[]> {
	const spent: ChargeConsumptionDetail[] = [];
	if (!actor || spends.length < 1 || !isResourceSpendingAutomationEnabled()) return spent;

	for (const entry of spends) {
		if (!entry || typeof entry.poolId !== 'string') continue;
		const count = Math.max(0, Math.floor(Number(entry.count) || 0));
		if (count < 1) continue;
		// 'add' takes only values of 0 or more, so set the pool to current minus count. getPools
		// also reads a pool that is kept on the actor, not on an item.
		const pool = getPools(actor).find((candidate) => candidate.id === entry.poolId);
		if (!pool) continue;
		const next = Math.max(0, pool.current - count);
		if (next === pool.current) continue;
		if (!(await adjustPool(actor, entry.poolId, 'set', next))) continue;
		spent.push({
			poolId: entry.poolId,
			poolLabel: pool.label,
			previousValue: pool.current,
			currentValue: next,
			maxValue: pool.max,
			change: next - pool.current,
		});
	}
	return spent;
}
