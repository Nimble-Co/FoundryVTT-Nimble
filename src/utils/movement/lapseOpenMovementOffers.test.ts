import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MovementOffer } from '#types/movement.js';
import {
	combatTokenUuids,
	lapseOpenMovementOffers,
	untrackOpenMovementOffers,
} from './lapseOpenMovementOffers.js';

type GameStub = {
	user: { id: string; isGM: boolean };
	users: { activeGM: { id: string } | null };
	messages: { contents: unknown[] };
	settings: { get: () => unknown };
};
const g = globalThis as unknown as { game: GameStub };
const baseGame = g.game;

function offer(id: string, tokenUuid: string, state: MovementOffer['state'] = 'open') {
	return { id, tokenUuid, state, spaces: 2 } as MovementOffer;
}

let update: ReturnType<typeof vi.fn>;
let offersEnabled: boolean;

beforeEach(() => {
	update = vi.fn().mockResolvedValue(undefined);
	offersEnabled = true;
	vi.stubGlobal('game', {
		...baseGame,
		user: { id: 'gm', isGM: true },
		users: { activeGM: { id: 'gm' } },
		settings: { get: () => offersEnabled },
		messages: {
			contents: [
				{
					system: {
						movementOffers: [
							offer('here', 'Scene.s1.Token.a'),
							offer('there', 'Scene.s2.Token.b'),
							offer('done', 'Scene.s1.Token.c', 'taken'),
						],
					},
					update,
				},
				{ system: {}, update: vi.fn() },
			],
		},
	} as GameStub);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

const written = () =>
	(update.mock.calls[0]?.[0]?.system?.movementOffers ?? []).map(
		(o: MovementOffer) => `${o.id}:${o.state}`,
	);

describe('lapseOpenMovementOffers', () => {
	it('lapses the open offers to the tokens and leaves settled ones and other tokens alone', async () => {
		await lapseOpenMovementOffers(new Set(['Scene.s1.Token.a', 'Scene.s1.Token.c']));
		expect(written()).toEqual(['here:lapsed', 'there:open', 'done:taken']);
	});

	it('leaves the offer of a token on the same scene that is not named', async () => {
		await lapseOpenMovementOffers(new Set(['Scene.s1.Token.other']));
		expect(update).not.toHaveBeenCalled();
	});

	it('lapses nothing when there is no token', async () => {
		await lapseOpenMovementOffers(new Set());
		expect(update).not.toHaveBeenCalled();
	});

	it('writes nothing off the primary GM or with Movement Offers off', async () => {
		const tokens = new Set(['Scene.s1.Token.a']);
		g.game.user = { id: 'p1', isGM: false };
		await lapseOpenMovementOffers(tokens);
		g.game.user = { id: 'gm2', isGM: true };
		await lapseOpenMovementOffers(tokens);
		g.game.user = { id: 'gm', isGM: true };
		offersEnabled = false;
		await lapseOpenMovementOffers(tokens);
		expect(update).not.toHaveBeenCalled();
	});
});

describe('untrackOpenMovementOffers', () => {
	it('untracks every open offer on every scene, even with Movement Offers off', async () => {
		offersEnabled = false;
		await untrackOpenMovementOffers();
		expect(written()).toEqual(['here:untracked', 'there:untracked', 'done:taken']);
	});

	it('writes nothing off the primary GM', async () => {
		g.game.user = { id: 'p1', isGM: false };
		await untrackOpenMovementOffers();
		expect(update).not.toHaveBeenCalled();
	});
});

describe('combatTokenUuids', () => {
	it('is the token of each combatant, on the scene the combatant names', () => {
		const uuids = combatTokenUuids({
			combatants: [
				{ tokenId: 'a', sceneId: 's2' },
				{ tokenId: 'b', sceneId: null, token: { parent: { id: 's3' } } },
				{ tokenId: null, sceneId: 's2' },
				{ tokenId: 'c' },
				{},
			],
		});
		expect([...uuids].sort()).toEqual(['Scene.s2.Token.a', 'Scene.s3.Token.b']);
	});

	it('is empty for a combat with no combatants', () => {
		expect(combatTokenUuids({ combatants: [] }).size).toBe(0);
		expect(combatTokenUuids({}).size).toBe(0);
	});
});
