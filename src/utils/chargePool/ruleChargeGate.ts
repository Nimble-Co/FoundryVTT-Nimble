import { isResourceSpendingAutomationEnabled } from '../../settings/automationSettings.js';
import { adjustPool } from './chargePoolRecover.js';
import {
	buildEffectiveChargePoolMap,
	findChargePoolByIdentifier,
	isCharacterActor,
} from './helpers.js';

function findPool(actor: Actor | null | undefined, identifier: string) {
	if (!isCharacterActor(actor)) return null;
	return findChargePoolByIdentifier(buildEffectiveChargePoolMap(actor), identifier);
}

/**
 * Whether a rule limited by a charge pool may fire. An empty identifier means
 * unlimited. Pools exist on character actors only, so any other actor fails.
 * With resource spending automation off the pool is not a limit.
 */
export function hasRuleCharge(actor: Actor | null | undefined, identifier: string): boolean {
	const id = identifier.trim();
	if (!id || !isResourceSpendingAutomationEnabled()) return true;
	return (findPool(actor, id)?.pool.current ?? 0) >= 1;
}

/** Spends one charge for a rule that fired. No-op when `hasRuleCharge` would not limit it. */
export async function spendRuleCharge(
	actor: Actor | null | undefined,
	identifier: string,
): Promise<void> {
	const id = identifier.trim();
	if (!id || !isResourceSpendingAutomationEnabled()) return;
	const entry = findPool(actor, id);
	if (!entry || entry.pool.current < 1) return;
	await adjustPool(actor, entry.key, 'set', entry.pool.current - 1);
}
