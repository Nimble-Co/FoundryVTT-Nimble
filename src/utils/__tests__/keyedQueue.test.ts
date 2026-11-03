import { describe, expect, it } from 'vitest';
import { keyedQueue } from '../keyedQueue.ts';

function gate() {
	let open: () => void = () => undefined;
	const closed = new Promise<void>((resolve) => {
		open = resolve;
	});
	return { closed, open };
}

describe('keyedQueue', () => {
	it('runs the tasks of one key one at a time, and gives each result', async () => {
		const queue = keyedQueue();
		const events: string[] = [];
		const first = gate();

		const a = queue.run('card', async () => {
			events.push('start:a');
			await first.closed;
			events.push('end:a');
			return 'a';
		});
		const b = queue.run('card', async () => {
			events.push('start:b');
			return 'b';
		});

		await Promise.resolve();
		expect(events).toEqual(['start:a']);
		first.open();
		await expect(a).resolves.toBe('a');
		await expect(b).resolves.toBe('b');
		expect(events).toEqual(['start:a', 'end:a', 'start:b']);
	});

	it('runs the next task after a task that threw, and gives the error to its caller', async () => {
		const queue = keyedQueue();
		const failed = queue.run('card', async () => {
			throw new Error('no');
		});
		const next = queue.run('card', async () => 'next');

		await expect(failed).rejects.toThrow('no');
		await expect(next).resolves.toBe('next');
	});

	it('does not make tasks of other keys wait', async () => {
		const queue = keyedQueue();
		const held = gate();
		void queue.run('one', () => held.closed);

		await expect(queue.run('two', async () => 'two')).resolves.toBe('two');
		held.open();
	});

	it('settles when the tasks of a key have settled, and does not reject', async () => {
		const queue = keyedQueue();
		const held = gate();
		let done = false;
		void queue
			.run('card', async () => {
				await held.closed;
				throw new Error('no');
			})
			.catch(() => undefined);
		const waiting = queue.settled('card').then(() => {
			done = true;
		});

		await Promise.resolve();
		expect(done).toBe(false);
		held.open();
		await waiting;
		expect(done).toBe(true);
		await expect(queue.settled('empty')).resolves.toBeUndefined();
	});

	it('lets a forgotten key run its next task at once', async () => {
		const queue = keyedQueue();
		const held = gate();
		void queue.run('combat:a', () => held.closed);
		queue.forget((key) => key.startsWith('combat:'));

		await expect(queue.run('combat:a', async () => 'now')).resolves.toBe('now');
		held.open();
	});
});
