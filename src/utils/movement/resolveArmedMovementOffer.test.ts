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
		offer: { messageId: 'm', offerId: 'n.gob' },
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
	const older = { id: 'm', system: { movementOffers: offers }, update };
	const newer = { id: 'm2', system: { movementOffers: [{ ...offers[0] }] }, update: vi.fn() };
	const messages = [older, newer];
	g.game = {
		...previousGame,
		user: { id: 'gm', isGM: true },
		messages: { contents: messages, get: (id: string) => messages.find((m) => m.id === id) },
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
	it('takes the offer the drag names, even when a newer card offers another', async () => {
		await resolveArmedMovementOffer(record({ spaces: 5 }));
		expect(written()).toMatchObject({ state: 'taken', usedBy: 'p1', movedSpaces: 2 });
	});

	it('leaves the offer the token carries unused when the Movement names none', async () => {
		const newerUpdate = (g.game.messages.get('m2') as { update: ReturnType<typeof vi.fn> }).update;
		await resolveArmedMovementOffer(record({ kind: 'regular', offer: null }));
		expect(update).not.toHaveBeenCalled();
		expect(newerUpdate.mock.calls[0]?.[0]?.system?.movementOffers?.[0]).toMatchObject({
			state: 'unused',
			movedSpaces: null,
		});
	});

	it('ignores a tag that names an offer to another token', async () => {
		await resolveArmedMovementOffer(record({ token: { uuid: 'Scene.s.Token.ogre' } as never }));
		expect(update).not.toHaveBeenCalled();
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

	it('does not settle an offer twice', async () => {
		offers[0].state = 'taken';
		await resolveArmedMovementOffer(record());
		expect(update).not.toHaveBeenCalled();
	});
});
