import type { CostReceipt } from '#types/costReceipt.d.ts';
import type { CostPayer } from '#types/useCost.d.ts';
import type { PoolUse } from '#types/useOption.d.ts';
import { hasRuleCharge, spendRuleCharge } from '../chargePool/ruleChargeGate.js';
import localize from '../localize.js';
import { giveBack, receiptOf } from './costLedger.js';

function noUseLeft(pool: PoolUse): string {
	return localize('NIMBLE.useOptions.noUseLeft', { pool: pool.label });
}

/** The notice for the first pool with no use left, or null when each pool has one. */
function emptyPoolNotice(actor: CostPayer, pools: readonly PoolUse[]): string | null {
	const empty = pools.find((pool) => !hasRuleCharge(actor, pool.identifier));
	return empty ? noUseLeft(empty) : null;
}

/**
 * Spend one use of each pool. Gives the receipts, or the notice for the pool with no use left
 * once the uses already spent are given back.
 */
async function spendPoolUses(
	actor: CostPayer,
	pools: readonly PoolUse[],
): Promise<{ receipts: CostReceipt[] } | { notice: string }> {
	const receipts: CostReceipt[] = [];
	for (const pool of pools) {
		if (!(await spendRuleCharge(actor, pool.identifier))) {
			for (const receipt of receipts) await giveBack(actor, receipt);
			return { notice: noUseLeft(pool) };
		}
		receipts.push(receiptOf({ charges: 1, chargePoolIdentifier: pool.identifier }));
	}
	return { receipts };
}

export { emptyPoolNotice, spendPoolUses };
