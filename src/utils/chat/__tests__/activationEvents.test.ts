import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CardEvent } from '#types/cardEvent.d.ts';
import { activationEventsOf, openActivationEvents } from '../activationEvents.js';

const line = (id: string, at: number): CardEvent => ({
	id,
	kind: 'poolGain',
	icon: 'fa-solid fa-dice',
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

	it('takes no line a while after the card', () => {
		vi.useFakeTimers();
		const actor = { uuid: 'Actor.c' };
		const use = openActivationEvents(actor);
		use?.posted(vi.fn(async () => true));

		vi.advanceTimersByTime(5000);

		expect(activationEventsOf(actor)).toBeNull();
	});

	it('takes no line for a use with no card', () => {
		const actor = { uuid: 'Actor.d' };

		openActivationEvents(actor)?.posted(null);

		expect(activationEventsOf(actor)).toBeNull();
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

	it('a use made during another use takes the lines while it is live', () => {
		const actor = { uuid: 'Actor.f' };
		openActivationEvents(actor);
		const inner = openActivationEvents(actor);

		expect(activationEventsOf(actor)).toBe(inner);
	});

	it('the outer use takes the lines again once the use made during it closes', async () => {
		const actor = { uuid: 'Actor.g' };
		const outer = openActivationEvents(actor);
		const inner = openActivationEvents(actor);

		inner?.close();
		await activationEventsOf(actor)?.add([line('outer', 1)]);

		expect(activationEventsOf(actor)).toBe(outer);
		expect(outer?.take().map((event) => event.id)).toEqual(['outer']);
	});

	it('the outer use takes the lines again once the window of the inner card ends', () => {
		vi.useFakeTimers();
		const actor = { uuid: 'Actor.h' };
		const outer = openActivationEvents(actor);
		openActivationEvents(actor)?.posted(vi.fn(async () => true));

		vi.advanceTimersByTime(5000);

		expect(activationEventsOf(actor)).toBe(outer);
	});

	it('has no use outside an item use', () => {
		expect(activationEventsOf({ uuid: 'Actor.none' })).toBeNull();
		expect(activationEventsOf(null)).toBeNull();
	});
});
