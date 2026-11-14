import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const effectsEndingAt = vi.fn((..._args: unknown[]): object[] => []);
const endEffects = vi.fn(async (..._args: unknown[]) => true);
const waitEndEffects = vi.fn(async (..._args: unknown[]) => true);

// Setup loads this module through game.ts, so a hoisted vi.mock would miss it.
vi.resetModules();
vi.doMock('../endEffects.js', () => ({ effectsEndingAt, endEffects }));
vi.doMock('../waitEndEffects.js', () => ({ waitEndEffects }));
const { fireEvent } = await import('../lastsUntilEvents.js');

const tessa = { name: 'Tessa' };
const game = (globalThis as unknown as { game: Record<string, unknown> }).game;

describe('an event with Feature Effects off', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		game.settings = { get: () => false };
	});

	afterEach(() => {
		delete game.settings;
	});

	it('ends nothing: each effect it reaches gets a waiting line on the card of the event', () => {
		const invisible = { id: 'inv' };
		effectsEndingAt.mockReturnValue([invisible]);

		fireEvent('attack', tessa, {}, { id: 'attack1' });

		expect(endEffects).not.toHaveBeenCalled();
		expect(waitEndEffects).toHaveBeenCalledWith(
			[invisible],
			{
				heading: expect.objectContaining({ key: 'NIMBLE.lastsUntil.chat.heading.attack' }),
				hostId: 'attack1',
			},
			{ check: { type: 'event', event: 'attack', actor: tessa } },
			{},
		);
	});

	it('with Feature Effects on, ends as before', () => {
		game.settings = { get: () => true };
		effectsEndingAt.mockReturnValue([{ id: 'inv' }]);

		fireEvent('attack', tessa, {}, { id: 'attack1' });

		expect(waitEndEffects).not.toHaveBeenCalled();
		expect(endEffects).toHaveBeenCalledOnce();
	});
});
