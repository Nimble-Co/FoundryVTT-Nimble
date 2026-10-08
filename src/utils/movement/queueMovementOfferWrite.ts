let queue: Promise<unknown> = Promise.resolve();

/**
 * Runs `write` after every write to the Movement Offers on the cards queued
 * before it. Each write replaces a card's whole list of offers, so two that run
 * together would both start from the same list and the last would undo the
 * first. A write that fails does not stop the ones after it.
 */
export function queueMovementOfferWrite<T>(write: () => Promise<T>): Promise<T> {
	const run = queue.then(write);
	queue = run.catch(() => undefined);
	return run;
}
