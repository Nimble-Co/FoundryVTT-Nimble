import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MovementOffer, MovementRecord } from '#types/movement.js';

const getPrimaryActiveGmId = vi.hoisted(() => vi.fn<() => string | null>(() => 'gm'));
vi.mock('../getPrimaryActiveGmId.js', () => ({ getPrimaryActiveGmId }));

import { resolveArmedMovementOffer } from './resolveArmedMovementOffer.js';

type GameStub = {
	user: { id: string; isGM: boolean };
	messages: { contents: unknown[]; get: (id: string) => unknown };
};
const g = globalThis as unknown as { game: GameStub };
const previousGame = g.game;

let update: ReturnType<typeof vi.fn>;
let offers: MovementOffer[];

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
	offers = [
		{
			id: 'n.gob',
			nodeId: 'n',
			tokenUuid: 'Scene.s.Token.gob',
			name: 'Goblin',
			kind: 'forced',
			spaces: 2,
			ignoreDifficultTerrain: true,
			state: 'open',
			usedBy: null,
			movedSpaces: null,
			stopped: false,
		},
	];
	const message = { id: 'm', system: { movementOffers: offers }, update };
	g.game = {
		...previousGame,
		user: { id: 'gm', isGM: true },
		messages: { contents: [message], get: () => message },
	} as GameStub;
	getPrimaryActiveGmId.mockReturnValue('gm');
});

afterAll(() => {
	g.game = previousGame;
});

function written() {
	return update.mock.calls[0]?.[0]?.system?.movementOffers?.[0];
}

describe('resolveArmedMovementOffer', () => {
	it('records a Movement of the offered kind as the offer taken', async () => {
		await resolveArmedMovementOffer(record({ spaces: 5 }));
		expect(written()).toMatchObject({ state: 'taken', usedBy: 'p1', movedSpaces: 2 });
	});

	it('leaves the offer unused when the mover went their own way', async () => {
		await resolveArmedMovementOffer(record({ kind: 'regular' }));
		expect(written()).toMatchObject({ state: 'unused', movedSpaces: null });
	});

	it('leaves a teleport alone', async () => {
		await resolveArmedMovementOffer(record({ kind: 'teleport' }));
		expect(update).not.toHaveBeenCalled();
	});

	it('runs on the primary active GM only', async () => {
		g.game.user = { id: 'p1', isGM: false };
		await resolveArmedMovementOffer(record());
		g.game.user = { id: 'gm2', isGM: true };
		await resolveArmedMovementOffer(record());
		expect(update).not.toHaveBeenCalled();
	});

	it('does nothing when the token carries no offer', async () => {
		offers[0].state = 'taken';
		await resolveArmedMovementOffer(record());
		expect(update).not.toHaveBeenCalled();
	});
});
