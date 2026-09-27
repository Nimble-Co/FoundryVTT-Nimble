import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import type { MovementOffer, MovementRecord } from '#types/movement.js';

const getPrimaryActiveGmId = vi.hoisted(() => vi.fn<() => string | null>(() => 'gm'));
vi.mock('../getPrimaryActiveGmId.js', () => ({ getPrimaryActiveGmId }));
const isMovementOffersAutomationEnabled = vi.hoisted(() => vi.fn(() => true));
vi.mock('../../settings/automationSettings.js', () => ({ isMovementOffersAutomationEnabled }));

import { resolveArmedMovementOffer } from './resolveArmedMovementOffer.js';

type GameStub = {
	user: { id: string; isGM: boolean };
	messages: { contents: unknown[]; get: (id: string) => unknown };
};
const g = globalThis as unknown as { game: GameStub };
const baseGame = g.game;

type Card = { id: string; system: { movementOffers: MovementOffer[] }; update: Mock };
let older: Card;
let newer: Card;

function offer(over: Partial<MovementOffer> = {}): MovementOffer {
	return {
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
		conditional: false,
		...over,
	};
}

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

function card(id: string, offers: MovementOffer[]): Card {
	return { id, system: { movementOffers: offers }, update: vi.fn().mockResolvedValue(undefined) };
}

function useCards(...cards: Card[]) {
	g.game.messages = {
		contents: cards,
		get: (id: string) => cards.find((m) => m.id === id),
	};
}

function written(target: Card, index = 0): MovementOffer | undefined {
	return target.update.mock.calls[0]?.[0]?.system?.movementOffers?.[index];
}

beforeEach(() => {
	older = card('m', [offer()]);
	newer = card('m2', [offer()]);
	vi.stubGlobal('game', { ...baseGame, user: { id: 'gm', isGM: true } } as GameStub);
	useCards(older, newer);
	getPrimaryActiveGmId.mockReturnValue('gm');
	isMovementOffersAutomationEnabled.mockReturnValue(true);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('resolveArmedMovementOffer', () => {
	it('takes the offer the drag names, and leaves a newer open offer to the token unused', async () => {
		await resolveArmedMovementOffer(record({ spaces: 5 }));
		expect(written(older)).toMatchObject({ state: 'taken', usedBy: 'p1', movedSpaces: 2 });
		expect(written(newer)).toMatchObject({ state: 'unused', movedSpaces: null });
	});

	it('leaves every open offer to the token unused when the Movement names none', async () => {
		await resolveArmedMovementOffer(record({ kind: 'regular', offer: null }));
		expect(written(older)).toMatchObject({ state: 'unused', movedSpaces: null });
		expect(written(newer)).toMatchObject({ state: 'unused', movedSpaces: null });
	});

	it('leaves no older offer open to label the next Movement', async () => {
		await resolveArmedMovementOffer(record({ offer: { messageId: 'm2', offerId: 'n.gob' } }));
		expect(written(older)).toMatchObject({ state: 'unused' });
		expect(written(newer)).toMatchObject({ state: 'taken' });
	});

	it('settles two open offers to the token on one card', async () => {
		const both = card('m3', [offer(), offer({ id: 'k.gob', nodeId: 'k' })]);
		useCards(both);
		await resolveArmedMovementOffer(record({ offer: { messageId: 'm3', offerId: 'k.gob' } }));
		expect(both.update).toHaveBeenCalledTimes(1);
		expect(written(both, 0)).toMatchObject({ state: 'unused' });
		expect(written(both, 1)).toMatchObject({ state: 'taken' });
	});

	it('leaves offers to other tokens, conditional offers and offers of no distance alone', async () => {
		const others = card('m3', [
			offer({ id: 'n.ogre', tokenUuid: 'Scene.s.Token.ogre' }),
			offer({ id: 'c.gob', nodeId: 'c', conditional: true }),
			offer({ id: 'z.gob', nodeId: 'z', spaces: 0 }),
		]);
		useCards(others);
		await resolveArmedMovementOffer(record({ offer: null }));
		expect(others.update).not.toHaveBeenCalled();
	});

	it('ignores a tag that names an offer to another token', async () => {
		await resolveArmedMovementOffer(record({ token: { uuid: 'Scene.s.Token.ogre' } as never }));
		expect(older.update).not.toHaveBeenCalled();
		expect(newer.update).not.toHaveBeenCalled();
	});

	it('leaves a teleport alone', async () => {
		await resolveArmedMovementOffer(record({ kind: 'teleport' }));
		expect(older.update).not.toHaveBeenCalled();
		expect(newer.update).not.toHaveBeenCalled();
	});

	it('settles nothing for an untagged Movement while Movement Offers are off', async () => {
		isMovementOffersAutomationEnabled.mockReturnValue(false);
		await resolveArmedMovementOffer(record({ offer: null }));
		expect(older.update).not.toHaveBeenCalled();
		expect(newer.update).not.toHaveBeenCalled();
	});

	it('runs on the primary active GM only', async () => {
		g.game.user = { id: 'p1', isGM: false };
		await resolveArmedMovementOffer(record());
		g.game.user = { id: 'gm2', isGM: true };
		await resolveArmedMovementOffer(record());
		expect(older.update).not.toHaveBeenCalled();
		expect(newer.update).not.toHaveBeenCalled();
	});

	it('does not settle an offer twice', async () => {
		older.system.movementOffers[0].state = 'taken';
		newer.system.movementOffers[0].state = 'unused';
		await resolveArmedMovementOffer(record());
		expect(older.update).not.toHaveBeenCalled();
		expect(newer.update).not.toHaveBeenCalled();
	});
});
