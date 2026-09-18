import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MovementRecord } from '#types/movement.js';

const findArmedMovementOffer = vi.hoisted(() => vi.fn());
const getPrimaryActiveGmId = vi.hoisted(() => vi.fn<() => string | null>(() => 'gm'));
vi.mock('./findArmedMovementOffer.js', () => ({ findArmedMovementOffer }));
vi.mock('../getPrimaryActiveGmId.js', () => ({ getPrimaryActiveGmId }));

import { resolveArmedMovementOffer } from './resolveArmedMovementOffer.js';

type GameStub = {
	user: { id: string; isGM: boolean };
	messages: { get: (id: string) => unknown };
};
const g = globalThis as unknown as { game: GameStub };
const previousGame = g.game;

let update: ReturnType<typeof vi.fn>;

function record(over: Partial<MovementRecord> = {}): MovementRecord {
	return {
		token: { uuid: 'Scene.s.Token.gob' },
		kind: 'forced',
		spaces: 2,
		stopped: false,
		user: { id: 'p1' },
		...over,
	} as unknown as MovementRecord;
}

beforeEach(() => {
	update = vi.fn().mockResolvedValue(undefined);
	g.game = {
		...previousGame,
		user: { id: 'gm', isGM: true },
		messages: { get: () => ({ system: { movementOffers: [] }, update }) },
	} as GameStub;
	getPrimaryActiveGmId.mockReturnValue('gm');
	findArmedMovementOffer.mockReturnValue({
		offer: { id: 'm.n.gob', kind: 'forced', spaces: 2, messageId: 'm' },
		node: { id: 'n' },
	});
});

afterAll(() => {
	g.game = previousGame;
});

function entry() {
	return update.mock.calls[0]?.[0]?.system?.movementOffers?.[0];
}

describe('resolveArmedMovementOffer', () => {
	it('records the spaces a Movement of the offered kind covered', async () => {
		await resolveArmedMovementOffer(record());
		expect(entry()).toEqual({
			id: 'm.n.gob',
			nodeId: 'n',
			tokenUuid: 'Scene.s.Token.gob',
			spaces: 2,
			used: true,
			usedBy: 'p1',
			movedSpaces: 2,
			stopped: false,
		});
	});

	it('keeps a shortened push as the spaces it really covered', async () => {
		await resolveArmedMovementOffer(record({ spaces: 1, stopped: true }));
		expect(entry()).toMatchObject({ movedSpaces: 1, stopped: true });
	});

	it('never records more than was offered', async () => {
		await resolveArmedMovementOffer(record({ spaces: 9 }));
		expect(entry()).toMatchObject({ movedSpaces: 2 });
	});

	it('spends the offer unused when the mover went their own way', async () => {
		await resolveArmedMovementOffer(record({ kind: 'regular' }));
		expect(entry()).toMatchObject({ used: true, movedSpaces: null, stopped: false });
	});

	it('leaves a teleport alone', async () => {
		await resolveArmedMovementOffer(record({ kind: 'teleport' }));
		expect(update).not.toHaveBeenCalled();
	});

	it('runs on the primary active GM only', async () => {
		g.game.user = { id: 'p1', isGM: false };
		await resolveArmedMovementOffer(record());
		expect(update).not.toHaveBeenCalled();

		g.game.user = { id: 'gm2', isGM: true };
		getPrimaryActiveGmId.mockReturnValue('gm');
		await resolveArmedMovementOffer(record());
		expect(update).not.toHaveBeenCalled();
	});

	it('does nothing when the token carries no offer', async () => {
		findArmedMovementOffer.mockReturnValue(null);
		await resolveArmedMovementOffer(record());
		expect(update).not.toHaveBeenCalled();
	});
});
