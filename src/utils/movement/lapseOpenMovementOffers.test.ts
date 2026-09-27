import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MovementOffer } from '#types/movement.js';
import {
	combatSceneIds,
	lapseAllOpenMovementOffers,
	lapseOpenMovementOffers,
} from './lapseOpenMovementOffers.js';

type GameStub = {
	user: { id: string; isGM: boolean };
	users: { activeGM: { id: string } | null };
	messages: { contents: unknown[] };
	settings: { get: () => unknown };
};
const g = globalThis as unknown as { game: GameStub };
const previousGame = g.game;

function offer(id: string, tokenUuid: string, state: MovementOffer['state'] = 'open') {
	return { id, tokenUuid, state, spaces: 2 } as MovementOffer;
}

let update: ReturnType<typeof vi.fn>;
let offersEnabled: boolean;

beforeEach(() => {
	update = vi.fn().mockResolvedValue(undefined);
	offersEnabled = true;
	g.game = {
		...previousGame,
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
	} as GameStub;
});

afterAll(() => {
	g.game = previousGame;
});

const written = () =>
	(update.mock.calls[0]?.[0]?.system?.movementOffers ?? []).map(
		(o: MovementOffer) => `${o.id}:${o.state}`,
	);

describe('lapseOpenMovementOffers', () => {
	it('lapses the open offers on the scenes and leaves settled ones and other scenes alone', async () => {
		await lapseOpenMovementOffers(new Set(['s1']));
		expect(written()).toEqual(['here:lapsed', 'there:open', 'done:taken']);
	});

	it('lapses nothing when there is no scene', async () => {
		await lapseOpenMovementOffers(new Set());
		expect(update).not.toHaveBeenCalled();
	});

	it('writes nothing off the primary GM or with Movement Offers off', async () => {
		g.game.user = { id: 'p1', isGM: false };
		await lapseOpenMovementOffers(new Set(['s1']));
		g.game.user = { id: 'gm2', isGM: true };
		await lapseOpenMovementOffers(new Set(['s1']));
		g.game.user = { id: 'gm', isGM: true };
		offersEnabled = false;
		await lapseOpenMovementOffers(new Set(['s1']));
		expect(update).not.toHaveBeenCalled();
	});
});

describe('lapseAllOpenMovementOffers', () => {
	it('lapses every open offer on every scene, even with Movement Offers off', async () => {
		offersEnabled = false;
		await lapseAllOpenMovementOffers();
		expect(written()).toEqual(['here:lapsed', 'there:lapsed', 'done:taken']);
	});

	it('writes nothing off the primary GM', async () => {
		g.game.user = { id: 'p1', isGM: false };
		await lapseAllOpenMovementOffers();
		expect(update).not.toHaveBeenCalled();
	});
});

describe('combatSceneIds', () => {
	it('is the combat scene and the scene of each combatant', () => {
		const ids = combatSceneIds({
			scene: { id: 's1' },
			combatants: [{ sceneId: 's2' }, { sceneId: null, token: { parent: { id: 's3' } } }, {}],
		});
		expect([...ids].sort()).toEqual(['s1', 's2', 's3']);
	});

	it('is only the combatant scenes for a combat with no scene, and empty with no combatants', () => {
		expect([...combatSceneIds({ scene: null, combatants: [{ sceneId: 's2' }] })]).toEqual(['s2']);
		expect(combatSceneIds({ scene: null, combatants: [] }).size).toBe(0);
	});
});
