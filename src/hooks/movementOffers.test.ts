import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MovementOffer } from '#types/movement.js';

const handlers = new Map<string, (...args: unknown[]) => unknown>();
const resolveArmedMovementOffer = vi.hoisted(() => vi.fn());
vi.mock('#utils/movement/resolveArmedMovementOffer.js', () => ({ resolveArmedMovementOffer }));

import { SYSTEM_ID, systemHookName } from '#system';
import registerMovementOffers from './movementOffers.js';

type GameStub = {
	user: { id: string; isGM: boolean };
	users: { activeGM: { id: string } | null };
	messages: { contents: unknown[] };
	settings: { get: () => unknown };
	combats?: unknown[];
};
const g = globalThis as unknown as { game: GameStub; Hooks: unknown };
const previous = { game: g.game, Hooks: g.Hooks };

function offer(id: string, tokenUuid: string, state: MovementOffer['state'] = 'open') {
	return { id, tokenUuid, state, spaces: 2 } as MovementOffer;
}

let update: ReturnType<typeof vi.fn>;
let offersEnabled: boolean;

function stubGame(): GameStub {
	return {
		...previous.game,
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
			],
		},
	} as GameStub;
}

const fighter = (id: string) => ({ id, sceneId: 's1' });

beforeAll(() => {
	g.Hooks = {
		on: (event: string, handler: (...args: unknown[]) => unknown) => handlers.set(event, handler),
	};
	g.game = {
		...stubGame(),
		combats: [{ id: 'loaded', round: 1, combatant: fighter('a'), scene: { id: 's1' } }],
	};
	registerMovementOffers();
	registerMovementOffers();
});

beforeEach(() => {
	update = vi.fn().mockResolvedValue(undefined);
	offersEnabled = true;
	resolveArmedMovementOffer.mockClear();
	g.game = stubGame();
});

afterAll(() => {
	g.game = previous.game;
	g.Hooks = previous.Hooks;
});

const written = () =>
	(update.mock.calls[0]?.[0]?.system?.movementOffers ?? []).map(
		(o: MovementOffer) => `${o.id}:${o.state}`,
	);
const sceneOneLapsed = ['here:lapsed', 'there:open', 'done:taken'];
const everyOpenOfferLapsed = ['here:lapsed', 'there:lapsed', 'done:taken'];

describe('registerMovementOffers', () => {
	it('records an offer after every finished Movement', () => {
		const record = { kind: 'forced' };
		handlers.get(systemHookName('movementFinished'))?.(record);
		expect(resolveArmedMovementOffer).toHaveBeenCalledWith(record);
	});

	describe('when the combat updates', () => {
		let nextCombatId = 0;
		function makeCombat(scene: { id: string } | null = { id: 's1' }) {
			const combat = {
				id: `combat-${nextCombatId++}`,
				round: 1,
				turn: 0,
				combatant: fighter('a') as { id: string } | null,
				scene,
				combatants: [fighter('a'), fighter('b')],
			};
			handlers.get('createCombat')?.(combat);
			return combat;
		}

		it('lapses nothing for a change with no turn or round', async () => {
			handlers.get('updateCombat')?.(makeCombat(), { active: true });
			await Promise.resolve();
			expect(update).not.toHaveBeenCalled();
		});

		it('lapses nothing when a re-sort writes a new turn index for the same combatant', async () => {
			const combat = makeCombat();
			combat.turn = 1;
			handlers.get('updateCombat')?.(combat, { turn: 1 });
			await Promise.resolve();
			expect(update).not.toHaveBeenCalled();
		});

		it('lapses offers when the current combatant changes', async () => {
			const combat = makeCombat();
			combat.turn = 1;
			combat.combatant = fighter('b');
			handlers.get('updateCombat')?.(combat, { turn: 1 });
			await vi.waitFor(() => expect(written()).toEqual(sceneOneLapsed));
		});

		it('lapses offers when the round changes, even for the same combatant', async () => {
			const combat = makeCombat();
			combat.round = 2;
			handlers.get('updateCombat')?.(combat, { round: 2, turn: 0 });
			await vi.waitFor(() => expect(update).toHaveBeenCalledOnce());
		});

		it('compares with the last turn it saw, not the one before a re-sort', async () => {
			const combat = makeCombat();
			combat.combatant = fighter('b');
			handlers.get('updateCombat')?.(combat, { turn: 1 });
			await vi.waitFor(() => expect(update).toHaveBeenCalledOnce());
			combat.turn = 0;
			handlers.get('updateCombat')?.(combat, { turn: 0 });
			await Promise.resolve();
			expect(update).toHaveBeenCalledOnce();
		});

		it('knows the turn of a combat that existed when it registered', async () => {
			handlers.get('updateCombat')?.(
				{ id: 'loaded', round: 1, combatant: fighter('a'), scene: { id: 's1' } },
				{ turn: 2 },
			);
			await Promise.resolve();
			expect(update).not.toHaveBeenCalled();
		});

		it('falls back to the Foundry previous turn for a combat it has not seen', async () => {
			const combat = {
				id: 'unseen',
				round: 1,
				combatant: fighter('a'),
				previous: { round: 1, combatantId: 'a' },
				scene: { id: 's1' },
				combatants: [fighter('a')],
			};
			handlers.get('updateCombat')?.(combat, { turn: 1 });
			await Promise.resolve();
			expect(update).not.toHaveBeenCalled();
		});

		it('lapses only the offers on the combatant scenes for a combat with no scene', async () => {
			const combat = makeCombat(null);
			combat.combatant = fighter('b');
			handlers.get('updateCombat')?.(combat, { turn: 1 });
			await vi.waitFor(() => expect(written()).toEqual(sceneOneLapsed));
		});
	});

	it('lapses offers on the combat scenes when the combat is deleted', async () => {
		handlers.get('deleteCombat')?.({ id: 'gone', scene: null, combatants: [{ sceneId: 's1' }] });
		await vi.waitFor(() => expect(written()).toEqual(sceneOneLapsed));
	});

	describe('when a toggle that gates Movement Offers changes', () => {
		const setting = (key: string, value: boolean) => ({
			key: `${SYSTEM_ID}.${key}`,
			value,
			config: { default: true },
		});

		it.each([
			['automation.movementOffers', true],
			['automation.movementOffers', false],
			['automation.movementTracking', true],
			['automation.movementTracking', false],
		])('lapses every open offer when %s turns %s', async (key, value) => {
			offersEnabled = value;
			handlers.get('updateSetting')?.(setting(key, value), { value });
			await vi.waitFor(() => expect(written()).toEqual(everyOpenOfferLapsed));
		});

		it('lapses every open offer when the first write turns a toggle off', async () => {
			offersEnabled = false;
			handlers.get('createSetting')?.(setting('automation.movementOffers', false));
			await vi.waitFor(() => expect(written()).toEqual(everyOpenOfferLapsed));
		});

		it('writes nothing for a first write that holds the default, another setting, or no value change', async () => {
			handlers.get('createSetting')?.(setting('automation.movementOffers', true));
			handlers.get('updateSetting')?.(setting('automation.chatNotifications', false), {
				value: false,
			});
			handlers.get('updateSetting')?.(setting('automation.movementOffers', false), {
				_stats: {},
			});
			await Promise.resolve();
			expect(update).not.toHaveBeenCalled();
		});

		it('writes nothing off the primary GM', async () => {
			g.game.user = { id: 'p1', isGM: false };
			handlers.get('updateSetting')?.(setting('automation.movementOffers', false), {
				value: false,
			});
			await Promise.resolve();
			expect(update).not.toHaveBeenCalled();
		});
	});
});
