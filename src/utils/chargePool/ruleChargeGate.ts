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

const pending = new WeakMap<object, Map<string, Promise<void>>>();

/**
 * Runs `post` while the rule may fire, and spends one charge when it returns a
 * card. The pool value changes only when the server answers the spend, so
 * calls for one actor and pool run one after another: a call that starts while
 * an earlier one is still posting waits, then sees that spend.
 */
export function withRuleCharge(
	actor: Actor | null | undefined,
	identifier: string,
	post: () => Promise<unknown>,
): Promise<void> {
	const id = identifier.trim();
	if (!id || !isResourceSpendingAutomationEnabled() || !actor) {
		return (async () => {
			if (!hasRuleCharge(actor, id)) return;
			await post();
		})();
	}

	let chains = pending.get(actor);
	if (!chains) {
		chains = new Map();
		pending.set(actor, chains);
	}
	const run = (chains.get(id) ?? Promise.resolve()).then(async () => {
		if (!hasRuleCharge(actor, id)) return;
		const card = await post();
		if (card) await spendRuleCharge(actor, id);
	});
	const settled = run.catch(() => undefined);
	chains.set(id, settled);
	void settled.then(() => {
		if (chains.get(id) === settled) chains.delete(id);
	});
	return run;
}
