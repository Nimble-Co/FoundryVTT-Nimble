import type { DicePoolSpendRequestPayload } from './types.js';

const pending = new Map<string, DicePoolSpendRequestPayload>();

/**
 * Spend requests waiting for a DicePoolTracker to mount. The live
 * `dicePool.requestSpend` listener exists only while a character sheet's
 * tracker is rendered, so the ready-hook router parks a request here when the
 * actor's sheet is closed and opens the sheet; the tracker consumes the entry
 * on mount. Keyed by actor UUID — a newer request replaces an older one.
 */
const pendingSpendRequests = {
	set(payload: DicePoolSpendRequestPayload): void {
		pending.set(payload.actorUuid, payload);
	},
	take(actorUuid: string): DicePoolSpendRequestPayload | null {
		const payload = pending.get(actorUuid) ?? null;
		pending.delete(actorUuid);
		return payload;
	},
};

export { pendingSpendRequests };
