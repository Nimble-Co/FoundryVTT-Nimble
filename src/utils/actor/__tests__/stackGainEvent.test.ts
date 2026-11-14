import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StackReached } from '#types/effectPayload.d.ts';

const addCardEvents = vi.fn(async (..._args: unknown[]) => true);
const addMomentEvents = vi.fn(async (..._args: unknown[]) => true);

// Setup loads this module through game.ts, so a hoisted vi.mock would miss it.
let postStackGain: typeof import('../stackGainEvent.js').postStackGain;

beforeAll(async () => {
	vi.resetModules();
	vi.doMock('#utils/chat/cardEvents.js', () => ({ addCardEvents, addMomentEvents }));
	({ postStackGain } = await import('../stackGainEvent.js'));
});

beforeEach(() => {
	addCardEvents.mockClear();
	addMomentEvents.mockClear();
});

const holder = { uuid: 'Actor.hero', name: 'Tessa' };
const countOnly: StackReached = { count: 3, stackedName: 'Bleed', gainedName: 'Faint' };
const gained: StackReached = { ...countOnly, gainedUuid: 'Actor.hero.ActiveEffect.faint' };

describe('postStackGain', () => {
	it('with no card that caused the stack, a count with nothing to gain posts no card', async () => {
		expect(await postStackGain(holder, countOnly, null)).toBe(false);

		expect(addMomentEvents).not.toHaveBeenCalled();
		expect(addCardEvents).not.toHaveBeenCalled();
	});

	it('a count with nothing to gain still goes on the card that caused the stack', async () => {
		const card = { id: 'card' };
		const stub = game as unknown as { messages: unknown };
		const messages = stub.messages;
		stub.messages = { get: (id: string) => (id === 'card' ? card : undefined) };
		try {
			await postStackGain(holder, countOnly, 'card');
		} finally {
			stub.messages = messages;
		}

		expect(addCardEvents).toHaveBeenCalledWith(card, [
			expect.not.objectContaining({ action: expect.anything() }),
		]);
		expect(addMomentEvents).not.toHaveBeenCalled();
	});

	it('with no card that caused the stack, a gained effect gets a card of its own, with Undo', async () => {
		await postStackGain(holder, gained, null);

		expect(addMomentEvents).toHaveBeenCalledTimes(1);
		expect(addMomentEvents.mock.calls[0][1]).toEqual([
			expect.objectContaining({ action: expect.objectContaining({ state: 'gained' }) }),
		]);
	});
});
