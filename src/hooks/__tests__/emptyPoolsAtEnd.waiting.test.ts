import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CardEvent } from '#types/cardEvent.d.ts';
import { CONDITION_REPLACED_OPTION } from '#utils/actor/applyConditionToActor.js';
import { getTestGlobals } from '../../../tests/helpers.js';
import { createHookCapture } from '../../../tests/mocks/combat.js';

const setPoolFaces = vi.fn(async (..._args: unknown[]) => true);
const addMomentEvents = vi.fn(async (..._args: unknown[]) => true);
const line = (name: string): CardEvent => ({
	id: `pool.${name}`,
	kind: 'emptyPool',
	icon: 'fa-solid fa-dice',
	text: { key: 'NIMBLE.chat.emptyPool.text', data: { pool: name } },
	action: {
		kind: 'emptyPool',
		holderUuid: 'Actor.tessa',
		holderName: 'Tessa',
		poolId: name,
		poolLabel: name,
		state: 'waiting',
	},
	at: 1,
});
const emptyPoolEvents = vi.fn((..._args: unknown[]): CardEvent[] => [line('Fury Dice')]);

type DeleteHook = (effect: unknown, options: unknown, userId: string) => void;

function globals() {
	return getTestGlobals<{
		game: { user: { id: string } | null; settings?: unknown };
		Hooks: { on: unknown };
	}>();
}

async function registeredHook(): Promise<DeleteHook> {
	vi.resetModules();
	vi.doMock('#utils/dicePool/dicePoolRefill.js', () => ({ setPoolFaces }));
	vi.doMock('#utils/dicePool/emptyPoolLine.js', () => ({
		END_LINES_OPTION: 'nimbleEndLines',
		emptyPoolEvents,
	}));
	const cardEvents = await vi.importActual<typeof import('#utils/chat/cardEvents.js')>(
		'#utils/chat/cardEvents.js',
	);
	vi.doMock('#utils/chat/cardEvents.js', () => ({ ...cardEvents, addMomentEvents }));
	const callbacks = createHookCapture(globals().Hooks.on as never);
	const { default: register } = await import('../emptyPoolsAtEnd.js');
	register();
	return callbacks.get('deleteActiveEffect') as DeleteHook;
}

const holder = Object.assign(Object.create(Actor.prototype), { name: 'Tessa' }) as Actor;
const rage = { name: 'Rage', parent: holder, rules: new Map() };
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('Empty pools at end with Feature Effects off', () => {
	beforeEach(() => {
		setPoolFaces.mockClear();
		addMomentEvents.mockClear();
		emptyPoolEvents.mockClear();
		globals().game.user = { id: 'user-1' };
		globals().game.settings = { get: () => false };
	});

	afterEach(() => {
		delete globals().game.settings;
		vi.doUnmock('#utils/chat/cardEvents.js');
		vi.doUnmock('#utils/dicePool/emptyPoolLine.js');
	});

	it('an effect removed by hand empties nothing and gets a card of its own with the waiting lines', async () => {
		const hook = await registeredHook();

		hook(rage, {}, 'user-1');

		await vi.waitFor(() => expect(addMomentEvents).toHaveBeenCalledOnce());
		const [moment, lines] = addMomentEvents.mock.calls[0] as [
			{ key: string; heading: unknown },
			CardEvent[],
		];
		expect(moment.key).toMatch(/^once:/);
		expect(moment.heading).toEqual({
			key: 'NIMBLE.lastsUntil.chat.heading.effectEnds',
			data: { name: 'Tessa', item: '', effect: 'Rage' },
		});
		expect(lines.map((each) => each.id)).toEqual(['pool.Fury Dice']);
		expect(setPoolFaces).not.toHaveBeenCalled();
	});

	it('an end that posts its own lines, or a copy that replaces the effect, gives no card', async () => {
		const hook = await registeredHook();

		hook(rage, { nimbleEndLines: true }, 'user-1');
		hook(rage, { [CONDITION_REPLACED_OPTION]: true }, 'user-1');
		await settle();

		expect(addMomentEvents).not.toHaveBeenCalled();
		expect(setPoolFaces).not.toHaveBeenCalled();
	});

	it('an effect with no pool that holds dice gives no card', async () => {
		emptyPoolEvents.mockReturnValueOnce([]);
		const hook = await registeredHook();

		hook(rage, {}, 'user-1');
		await settle();

		expect(addMomentEvents).not.toHaveBeenCalled();
	});
});
