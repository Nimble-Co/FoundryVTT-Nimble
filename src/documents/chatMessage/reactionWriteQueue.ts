/**
 * Paid offers currently resolving (pool spends and rerolls), keyed
 * `<messageId>:<entryId>`.
 *
 * `used` is only written at the end of a resolve, several awaits in. A second
 * request arriving inside that window passes the unused-entry check and reads
 * the same unspent pool, so the cost comes out once and the effect lands
 * twice. Every request lands on the one primary GM's client, so an in-memory
 * lock is enough to serialize them.
 */
export const inFlightSpendOffers = new Set<string>();

/** In-flight reaction resolve per card, so the next one starts after it. */
const reactionWriteQueues = new Map<string, Promise<void>>();

/**
 * Run a reaction resolver with at most one in flight per card.
 *
 * Every resolver reads the card's `incomingReactions`, awaits — a roll
 * evaluation, a pool write — and then writes the whole array back. Two
 * resolvers overlapping on one card each write their own stale copy, and
 * whichever lands second drops the other's `used` flag. Routing every kind
 * through the primary GM gives us a single writing client; this gives that
 * client a single write in flight per card, which is what the routing was
 * credited with on its own.
 *
 * Keyed by message id rather than by entry, because the array is shared: two
 * *different* entries resolving at once is exactly the case an entry-level
 * lock misses.
 */
export function queueReactionWrite(messageId: string, task: () => Promise<void>): Promise<void> {
	const previous = reactionWriteQueues.get(messageId) ?? Promise.resolve();
	// Both paths run the task: a predecessor that threw must not wedge the card.
	const result = previous.then(task, task);
	const settled = result.then(
		() => undefined,
		() => undefined,
	);

	reactionWriteQueues.set(messageId, settled);
	void settled.then(() => {
		if (reactionWriteQueues.get(messageId) === settled) reactionWriteQueues.delete(messageId);
	});

	return result;
}
