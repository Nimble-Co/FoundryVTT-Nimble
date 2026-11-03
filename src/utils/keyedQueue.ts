/**
 * Tasks that run one at a time per key. Each task starts after the task before
 * it on the same key settles, also when that task threw. Tasks on different
 * keys do not wait for each other.
 */
export function keyedQueue() {
	const tails = new Map<string, Promise<void>>();

	/** Run `task` after the tasks of `key` in the queue now. Gives the result of `task`. */
	function run<T>(key: string, task: () => Promise<T>): Promise<T> {
		const result = (tails.get(key) ?? Promise.resolve()).then(task);
		const settled = result.then(
			() => undefined,
			() => undefined,
		);
		tails.set(key, settled);
		void settled.then(() => {
			if (tails.get(key) === settled) tails.delete(key);
		});
		return result;
	}

	/** Settles when the tasks of `key` in the queue now have settled. Never rejects. */
	function settled(key: string): Promise<void> {
		return tails.get(key) ?? Promise.resolve();
	}

	/** Stop waiting on the keys `matches` accepts. Their tasks in flight still run. */
	function forget(matches: (key: string) => boolean): void {
		for (const key of tails.keys()) {
			if (matches(key)) tails.delete(key);
		}
	}

	return { run, settled, forget };
}
