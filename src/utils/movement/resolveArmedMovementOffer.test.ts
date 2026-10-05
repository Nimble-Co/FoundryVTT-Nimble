import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import type { MovementOffer, MovementRecord, OfferRulerWaypoint } from '#types/movement.js';

const getPrimaryActiveGmId = vi.hoisted(() => vi.fn<() => string | null>(() => 'gm'));
vi.mock('../getPrimaryActiveGmId.js', () => ({ getPrimaryActiveGmId }));
const isMovementOffersAutomationEnabled = vi.hoisted(() => vi.fn(() => true));
vi.mock('../../settings/automationSettings.js', () => ({ isMovementOffersAutomationEnabled }));

import { markWaypointsPastOffer } from './markWaypointsPastOffer.js';
import { FREE_MOVEMENT_ACTION } from './movementActions.js';
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
		costSpaces: 2,
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

	describe('the measure of a taken offer', () => {
		const free = { kind: 'free' as const, ignoreDifficultTerrain: false };
		const overDifficultTerrain = { kind: 'free' as const, spaces: 1, costSpaces: 2 };

		it('counts a Free Move that honours difficult terrain by cost, as its ruler does', async () => {
			older.system.movementOffers = [offer(free)];
			await resolveArmedMovementOffer(record(overDifficultTerrain));
			expect(written(older)).toMatchObject({ state: 'taken', movedSpaces: 2 });
		});

		it('agrees with the ruler for the same drag', async () => {
			const path = [
				{
					stage: 'planned',
					action: 'walk',
					unreachable: false,
					measurement: { distance: 0, cost: 0 },
				},
				{
					stage: 'planned',
					action: FREE_MOVEMENT_ACTION,
					unreachable: false,
					measurement: { distance: 5, cost: 10 },
				},
			] as OfferRulerWaypoint[];
			for (const terms of [free, { ...free, ignoreDifficultTerrain: true }]) {
				older = card('m', [offer(terms)]);
				useCards(older);
				markWaypointsPastOffer(path, older.system.movementOffers[0], 5);
				await resolveArmedMovementOffer(record(overDifficultTerrain));
				expect(written(older)?.movedSpaces).toBe(path[1].offerBand?.spaces);
			}
		});

		it('counts a Free Move that ignores difficult terrain, and Forced Movement, by distance', async () => {
			older.system.movementOffers = [offer({ ...free, ignoreDifficultTerrain: true })];
			newer.system.movementOffers = [];
			await resolveArmedMovementOffer(record(overDifficultTerrain));
			expect(written(older)).toMatchObject({ state: 'taken', movedSpaces: 1 });

			const pushed = card('m', [offer()]);
			useCards(pushed);
			await resolveArmedMovementOffer(record({ spaces: 1, costSpaces: 2 }));
			expect(written(pushed)).toMatchObject({ state: 'taken', movedSpaces: 1 });
		});
	});

	it('keeps both settlements when two tokens with offers on one card stop together', async () => {
		const ogre = 'Scene.s.Token.ogre';
		const shared = card('m', [offer(), offer({ id: 'n.ogre', tokenUuid: ogre, name: 'Ogre' })]);
		const releases: (() => void)[] = [];
		// As the server does: the card holds the new offers only once the write lands.
		shared.update.mockImplementation(
			(changes: { system: { movementOffers: MovementOffer[] } }) =>
				new Promise<void>((resolve) => {
					releases.push(() => {
						shared.system.movementOffers = changes.system.movementOffers;
						resolve();
					});
				}),
		);
		useCards(shared);

		const first = resolveArmedMovementOffer(record());
		const second = resolveArmedMovementOffer(
			record({
				token: { uuid: ogre } as never,
				offer: { messageId: 'm', offerId: 'n.ogre' },
			}),
		);
		await vi.waitFor(() => expect(releases).toHaveLength(1));
		releases[0]();
		await vi.waitFor(() => expect(releases).toHaveLength(2));
		releases[1]();
		await Promise.all([first, second]);

		expect(shared.system.movementOffers.map((o) => o.state)).toEqual(['taken', 'taken']);
	});

	it('goes on settling after a write that failed', async () => {
		older.update.mockRejectedValueOnce(new Error('no write'));
		await expect(resolveArmedMovementOffer(record())).rejects.toThrow('no write');
		older.update.mockClear();
		await resolveArmedMovementOffer(record());
		expect(written(older)).toMatchObject({ state: 'taken' });
	});
});
