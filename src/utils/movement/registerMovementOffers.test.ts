import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MovementOffer } from '#types/movement.js';

const handlers = new Map<string, (...args: unknown[]) => unknown>();
const resolveArmedMovementOffer = vi.hoisted(() => vi.fn());
const getPrimaryActiveGmId = vi.hoisted(() => vi.fn<() => string | null>(() => 'gm'));
vi.mock('./resolveArmedMovementOffer.js', () => ({ resolveArmedMovementOffer }));
vi.mock('../getPrimaryActiveGmId.js', () => ({ getPrimaryActiveGmId }));

import { SYSTEM_ID, systemHookName } from '#system';
import {
	lapseOpenMovementOffers,
	registerMovementOfferListener,
} from './registerMovementOffers.js';

type GameStub = {
	user: { id: string; isGM: boolean };
	messages: { contents: unknown[] };
	settings: { get: () => unknown };
};
const g = globalThis as unknown as { game: GameStub; Hooks: unknown };
const previous = { game: g.game, Hooks: g.Hooks };

function offer(id: string, tokenUuid: string, state: MovementOffer['state'] = 'open') {
	return { id, tokenUuid, state } as MovementOffer;
}

let update: ReturnType<typeof vi.fn>;
let offersEnabled: boolean;

beforeAll(() => {
	g.Hooks = {
		on: (event: string, handler: (...args: unknown[]) => unknown) => handlers.set(event, handler),
	};
	registerMovementOfferListener();
});

beforeEach(() => {
	update = vi.fn().mockResolvedValue(undefined);
	offersEnabled = true;
	resolveArmedMovementOffer.mockClear();
	getPrimaryActiveGmId.mockReturnValue('gm');
	g.game = {
		...previous.game,
		user: { id: 'gm', isGM: true },
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
	g.game = previous.game;
	g.Hooks = previous.Hooks;
});

const written = () =>
	(update.mock.calls[0]?.[0]?.system?.movementOffers ?? []).map(
		(o: MovementOffer) => `${o.id}:${o.state}`,
	);

describe('lapseOpenMovementOffers', () => {
	it('lapses the open offers on the scene and leaves settled ones and other scenes alone', async () => {
		await lapseOpenMovementOffers('s1');
		expect(written()).toEqual(['here:lapsed', 'there:open', 'done:taken']);
	});

	it('lapses every open offer for a combat with no scene', async () => {
		await lapseOpenMovementOffers(null);
		expect(written()).toEqual(['here:lapsed', 'there:lapsed', 'done:taken']);
	});

	it('writes nothing off the primary GM or with Movement Offers off', async () => {
		g.game.user = { id: 'p1', isGM: false };
		await lapseOpenMovementOffers('s1');
		g.game.user = { id: 'gm', isGM: true };
		offersEnabled = false;
		await lapseOpenMovementOffers('s1');
		expect(update).not.toHaveBeenCalled();
	});
});

describe('registerMovementOfferListener', () => {
	it('records an offer after every finished Movement', () => {
		const record = { kind: 'forced' };
		handlers.get(systemHookName('movementFinished'))?.(record);
		expect(resolveArmedMovementOffer).toHaveBeenCalledWith(record);
	});

	it('lapses offers when the turn or round changes, and on nothing else', async () => {
		const combat = { scene: { id: 's1' } };
		handlers.get('updateCombat')?.(combat, { active: true });
		await vi.waitFor(() => expect(update).not.toHaveBeenCalled());
		handlers.get('updateCombat')?.(combat, { turn: 1 });
		await vi.waitFor(() => expect(update).toHaveBeenCalledOnce());
	});

	it('lapses offers when the combat is deleted', async () => {
		handlers.get('deleteCombat')?.({ scene: { id: 's1' } });
		await vi.waitFor(() => expect(written()).toEqual(['here:lapsed', 'there:open', 'done:taken']));
	});

	describe('when a toggle that gates Movement Offers changes', () => {
		const setting = (key: string, value: boolean) => ({
			key: `${SYSTEM_ID}.${key}`,
			value,
			config: { default: true },
		});
		const everyOpenOfferLapsed = ['here:lapsed', 'there:lapsed', 'done:taken'];

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
