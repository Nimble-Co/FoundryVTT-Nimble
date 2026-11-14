import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CardEvent } from '#types/cardEvent.d.ts';

const replaceCardEvent = vi.fn(async (..._args: unknown[]) => true);
const askActiveGm = vi.fn(async (..._args: unknown[]): Promise<unknown> => true);

// Setup loads these modules before a hoisted mock could apply.
vi.resetModules();
const cardEvents = await vi.importActual<typeof import('#utils/chat/cardEvents.js')>(
	'#utils/chat/cardEvents.js',
);
vi.doMock('#utils/chat/cardEvents.js', () => ({ ...cardEvents, replaceCardEvent }));
vi.doMock('#utils/askActiveGm.js', () => ({ askActiveGm }));
const { activeGmLine, runMarked } = await import('../lineClick.js');

const line = (state: string): CardEvent => ({
	id: 'line1',
	kind: 'emptyPool',
	icon: 'x',
	text: { key: state },
	action: {
		kind: 'emptyPool',
		holderUuid: 'Actor.a',
		holderName: 'A',
		poolId: 'p',
		poolLabel: 'Pool',
		state: state as never,
	},
	at: 1,
});
const card = { id: 'card1' };
const game = (globalThis as unknown as { game: Record<string, unknown> }).game;
let user: unknown;

beforeEach(() => {
	user = game.user;
	vi.clearAllMocks();
	replaceCardEvent.mockResolvedValue(true);
	game.user = { id: 'gm', isGM: true, isActiveGM: true };
});

afterEach(() => {
	game.user = user;
});

describe('runMarked', () => {
	it('marks the line only while it is in its state, then runs', async () => {
		const run = vi.fn(async () => true);

		expect(await runMarked(card, line('waiting'), line('emptied'), run)).toBe(true);

		expect(replaceCardEvent).toHaveBeenCalledWith(card, 'line1', line('emptied'), {
			ifState: 'waiting',
		});
		expect(run).toHaveBeenCalledOnce();
	});

	it('runs nothing when another click marked it first', async () => {
		replaceCardEvent.mockResolvedValueOnce(false);
		const run = vi.fn(async () => true);

		expect(await runMarked(card, line('waiting'), line('emptied'), run)).toBe(false);
		expect(run).not.toHaveBeenCalled();
	});

	it('an error puts the line back, only while it is still marked', async () => {
		const run = vi.fn(async (): Promise<boolean> => {
			throw new Error('locked');
		});

		await expect(runMarked(card, line('waiting'), line('emptied'), run)).rejects.toThrow('locked');
		expect(replaceCardEvent).toHaveBeenLastCalledWith(card, 'line1', line('waiting'), {
			ifState: 'emptied',
		});
	});
});

describe('activeGmLine', () => {
	it('the active GM acts on the line itself', async () => {
		const actHere = vi.fn(async () => true);

		expect(await activeGmLine('q', actHere).click(card, line('waiting'))).toBe(true);
		expect(actHere).toHaveBeenCalledWith(card, 'line1');
		expect(askActiveGm).not.toHaveBeenCalled();
	});

	it('another client asks the active GM', async () => {
		game.user = { id: 'p', isGM: false, isActiveGM: false };
		const actHere = vi.fn(async () => true);

		expect(await activeGmLine('q', actHere).click(card, line('waiting'))).toBe(true);
		expect(askActiveGm).toHaveBeenCalledWith('q', { messageId: 'card1', eventId: 'line1' });
		expect(actHere).not.toHaveBeenCalled();
	});

	it('a card with no id does nothing', async () => {
		const actHere = vi.fn(async () => true);

		expect(await activeGmLine('q', actHere).click({}, line('waiting'))).toBe(false);
		expect(actHere).not.toHaveBeenCalled();
	});
});
