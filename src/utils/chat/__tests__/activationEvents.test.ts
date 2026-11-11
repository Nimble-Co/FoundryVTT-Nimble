import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CardEvent } from '#types/cardEvent.d.ts';
import { activationEventsOf, openActivationEvents } from '../activationEvents.js';

const line = (id: string, at: number): CardEvent => ({
	id,
	kind: 'note',
	text: { key: id },
	at,
});

afterEach(() => {
	vi.useRealTimers();
});

describe('activation events', () => {
	it('collects the lines of a use until its card is made, in time order', async () => {
		const actor = { uuid: 'Actor.a' };
		const use = openActivationEvents(actor);
		expect(activationEventsOf(actor)).toBe(use);

		expect(await use?.add([line('late', 2)])).toBe(true);
		expect(await use?.add([line('early', 1)])).toBe(true);
		expect(use?.take().map((event) => event.id)).toEqual(['early', 'late']);
	});

	it('sends later lines to the card of the use', async () => {
		const actor = { uuid: 'Actor.b' };
		const use = openActivationEvents(actor);
		use?.take();
		const sink = vi.fn(async () => true);
		use?.posted(sink);

		expect(await activationEventsOf(actor)?.add([line('after', 3)])).toBe(true);
		expect(sink).toHaveBeenCalledWith([line('after', 3)]);
	});

	it('takes no line a while after the card, or for a use with no card', async () => {
		vi.useFakeTimers();
		const actor = { uuid: 'Actor.c' };
		const use = openActivationEvents(actor);
		use?.posted(vi.fn(async () => true));
		vi.advanceTimersByTime(5000);
		expect(activationEventsOf(actor)).toBeNull();

		const other = { uuid: 'Actor.d' };
		openActivationEvents(other)?.posted(null);
		expect(activationEventsOf(other)).toBeNull();
	});

	it('drops a use that stopped, and keeps the newer use of the actor', () => {
		const actor = { uuid: 'Actor.e' };
		const first = openActivationEvents(actor);
		const second = openActivationEvents(actor);
		first?.close();
		expect(activationEventsOf(actor)).toBe(second);
		second?.close();
		expect(activationEventsOf(actor)).toBeNull();
	});

	it('has no use outside an item use', () => {
		expect(activationEventsOf({ uuid: 'Actor.none' })).toBeNull();
		expect(activationEventsOf(null)).toBeNull();
	});
});
