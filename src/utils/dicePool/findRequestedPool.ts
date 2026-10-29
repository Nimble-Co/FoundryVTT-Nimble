import { getPools } from './dicePoolSync.js';
import { normalizeIdentifier } from './helpers.js';
import type { DicePoolSpendRequestPayload, DicePoolState } from './types.js';

/**
 * The pool of a spend request: the same match as `getDicePoolConsumers`, by identifier and scope.
 * The consumer can be on another item than the pool.
 */
export function findRequestedPool(
	actor: Actor | null | undefined,
	payload: DicePoolSpendRequestPayload,
): DicePoolState | null {
	const identifier = normalizeIdentifier(payload.poolIdentifier);
	if (identifier.length < 1) return null;
	return (
		getPools(actor).find(
			(pool) =>
				normalizeIdentifier(pool.identifier) === identifier && pool.scope === payload.poolScope,
		) ?? null
	);
}
