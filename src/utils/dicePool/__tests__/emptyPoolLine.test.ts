import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CardEvent, EmptyPoolAction } from '#types/cardEvent.d.ts';

const replaceCardEvent = vi.fn(async (..._args: unknown[]) => true);
const setPoolFaces = vi.fn(async (..._args: unknown[]) => true);
const poolsEmptiedAtEnd = vi.fn((_effect: unknown): unknown => null);

// Setup loads these modules before a hoisted mock could apply.
vi.resetModules();
const cardEvents = await vi.importActual<typeof import('#utils/chat/cardEvents.js')>(
	'#utils/chat/cardEvents.js',
);
vi.doMock('#utils/chat/cardEvents.js', () => ({ ...cardEvents, replaceCardEvent }));
vi.doMock('#utils/dicePool/dicePoolRefill.js', () => ({ setPoolFaces }));
vi.doMock('#utils/dicePool/poolsEmptiedAtEnd.js', () => ({ poolsEmptiedAtEnd }));
const { canEmptyPool, emptyPoolEvents, emptyPoolFromLine } = await import('../emptyPoolLine.js');

const tessa = { uuid: 'Actor.tessa', name: 'Tessa', isOwner: false };
const pool = (id: string, label: string, faces: number[]) => ({ id, label, faces });
const card = { id: 'turnCard', flags: {} };

function waitingLine(): CardEvent {
	return emptyPoolEvents([{ name: 'Rage' }], 7)[0];
}

beforeEach(() => {
	replaceCardEvent.mockClear();
	replaceCardEvent.mockResolvedValue(true);
	setPoolFaces.mockReset();
	setPoolFaces.mockResolvedValue(true);
	poolsEmptiedAtEnd.mockReturnValue({
		holder: tessa,
		pools: [pool('fury', 'Fury Dice', [3, 5]), pool('calm', 'Calm Dice', [])],
	});
	tessa.isOwner = false;
	const g = globalThis as unknown as { game: Record<string, unknown> };
	g.game.user = { id: 'gm', isGM: true, isActiveGM: true };
	vi.stubGlobal('fromUuidSync', (uuid: string) => (uuid === tessa.uuid ? tessa : null));
});

afterEach(() => vi.unstubAllGlobals());

describe('emptyPoolEvents', () => {
	it('gives a waiting line for each pool that holds dice', () => {
		const lines = emptyPoolEvents([{ name: 'Rage' }], 7);

		expect(lines).toEqual([
			{
				id: 'emptyPool.Actor.tessa.fury.7',
				kind: 'emptyPool',
				icon: 'fa-solid fa-dice',
				text: { key: 'NIMBLE.chat.emptyPool.text', data: { pool: 'Fury Dice' } },
				cause: {
					key: 'NIMBLE.lastsUntil.chat.ended',
					data: { effect: 'Rage', name: 'Tessa' },
				},
				action: {
					kind: 'emptyPool',
					holderUuid: 'Actor.tessa',
					holderName: 'Tessa',
					poolId: 'fury',
					poolLabel: 'Fury Dice',
					state: 'waiting',
				},
				at: 7,
			},
		]);
	});

	it('gives nothing for an effect with no holder', () => {
		poolsEmptiedAtEnd.mockReturnValue(null);

		expect(emptyPoolEvents([{ name: 'Rage' }], 7)).toEqual([]);
	});
});

describe('emptyPoolFromLine', () => {
	it('marks the line emptied while it still waits, then empties the pool', async () => {
		const line = waitingLine();

		expect(await emptyPoolFromLine(card, line)).toBe(true);

		expect(replaceCardEvent).toHaveBeenCalledWith(
			card,
			line.id,
			expect.objectContaining({
				text: { key: 'NIMBLE.chat.emptyPool.emptied', data: { pool: 'Fury Dice' } },
				action: expect.objectContaining({ state: 'emptied' }),
			}),
			{ ifState: 'waiting' },
		);
		expect(setPoolFaces).toHaveBeenCalledWith(tessa, 'fury', []);
	});

	it('a second click finds the line marked and empties nothing', async () => {
		replaceCardEvent.mockResolvedValueOnce(false);

		expect(await emptyPoolFromLine(card, waitingLine())).toBe(false);
		expect(setPoolFaces).not.toHaveBeenCalled();
	});

	it('an error puts the line back to waiting', async () => {
		const line = waitingLine();
		setPoolFaces.mockRejectedValueOnce(new Error('locked'));

		await expect(emptyPoolFromLine(card, line)).rejects.toThrow('locked');
		expect(replaceCardEvent).toHaveBeenLastCalledWith(card, line.id, line);
	});

	it('a player who does not own the holder cannot empty it', async () => {
		(globalThis as unknown as { game: Record<string, unknown> }).game.user = { isGM: false };
		const line = waitingLine();

		expect(canEmptyPool(line.action as EmptyPoolAction)).toBe(false);
		expect(await emptyPoolFromLine(card, line)).toBe(false);

		tessa.isOwner = true;
		expect(canEmptyPool(line.action as EmptyPoolAction)).toBe(true);
	});
});
