import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';

// Setup loads these modules before a hoisted mock could apply.
const replaceCardEvent = vi.fn(async (..._args: unknown[]) => true);
const addCardEvents = vi.fn(async () => true);
const endEffects = vi.fn(async () => true);
const waitEndEffects = vi.fn(async (..._args: unknown[]) => true);
const undoEndedEffect = vi.fn(async () => true);
vi.resetModules();
const cardEvents = await vi.importActual<typeof import('#utils/chat/cardEvents.js')>(
	'#utils/chat/cardEvents.js',
);
vi.doMock('#utils/chat/cardEvents.js', () => ({ ...cardEvents, addCardEvents, replaceCardEvent }));
vi.doMock('#utils/lastsUntil/endEffects.js', () => ({
	endEffects,
	undoEndedEffect,
	waitEndEffects,
}));
const { followSaveRequest, saveRequestEvents } = await import('../saveRequests.js');

const concentrating = {
	id: 'eConc',
	name: 'Concentration',
	active: true,
	statuses: new Set(['concentration']),
	system: {
		rules: [
			{ id: 'r1', type: 'saveOnEvent', event: 'takeDamage', saveType: 'strength', saveDC: '10' },
		],
	},
};
const tessa = {
	uuid: 'Actor.tessa',
	name: 'Tessa',
	effects: Object.assign([concentrating], {
		get: (id: string) => (id === 'eConc' ? concentrating : undefined),
	}),
	getRollData: () => ({}),
	rollSavingThrowToChat: vi.fn(async () => ({})),
};

const [line] = saveRequestEvents(tessa as never, 'takeDamage', 5);
const waitingEnd = {
	id: 'waitingEnd.Actor.tessa.eConc.9',
	kind: 'waitingEnd',
	icon: 'x',
	text: { key: 'NIMBLE.lastsUntil.chat.endsOn' },
	action: {
		kind: 'waitingEnd',
		holderUuid: 'Actor.tessa',
		holderName: 'Tessa',
		effectId: 'eConc',
		effectName: 'Concentration',
		state: 'waiting',
		end: { heading: { key: 'x' }, hostId: 'm1' },
	},
	at: 9,
};

let card: { id: string; flags: Record<string, any>; update: ReturnType<typeof vi.fn> };
const game = globalThis as unknown as { game: Record<string, unknown> };

beforeEach(() => {
	vi.clearAllMocks();
	game.game.settings = { get: () => false };
	vi.stubGlobal('fromUuidSync', () => tessa);
	card = {
		id: 'm1',
		flags: { [SYSTEM_ID]: { events: [line] } },
		update: vi.fn(async (changes: Record<string, string>) => {
			for (const [path, value] of Object.entries(changes)) {
				foundry.utils.setProperty(card, path, value);
			}
		}),
	};
	const save = {
		id: 's1',
		rolls: [{ total: 6 }],
		flags: { [SYSTEM_ID]: { saveRequest: { messageId: 'm1', event: line } } },
	};
	game.game.messages = { get: (id: string) => (id === 'm1' ? card : save) };
});

afterEach(() => {
	vi.unstubAllGlobals();
	delete game.game.settings;
});

describe('a failed requested save with Feature Effects off', () => {
	it('ends nothing: the card of the line gets the waiting line with End', async () => {
		await followSaveRequest({ messageId: 's1', outcome: 'fail' });

		expect(replaceCardEvent).toHaveBeenCalledWith(card, line.id, null);
		expect(endEffects).not.toHaveBeenCalled();
		expect(waitEndEffects).toHaveBeenCalledWith([concentrating], {
			heading: line.text,
			hostId: 'm1',
			reason: {
				key: 'NIMBLE.chat.saveRequest.rolled',
				data: { save: { key: 'NIMBLE.effectSheet.escape.saves.strength' }, total: 6, dc: 10 },
			},
		});
	});

	it('a reroll to a pass puts the kept line in place of the waiting line', async () => {
		card.flags[SYSTEM_ID].events = [waitingEnd];

		await followSaveRequest({ messageId: 's1', outcome: 'pass' });

		expect(undoEndedEffect).not.toHaveBeenCalled();
		expect(replaceCardEvent).toHaveBeenCalledWith(
			card,
			waitingEnd.id,
			expect.objectContaining({
				id: line.id,
				action: expect.objectContaining({ state: 'kept' }),
			}),
		);
	});
});
