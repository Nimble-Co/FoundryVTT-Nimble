import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';
import type { CardEvent, CritDiceSaveAction } from '#types/cardEvent.d.ts';

const LINK = {
	attackMessageId: 'attack',
	role: 'critBonus',
	actorUuid: 'Actor.hero',
	chargePoolIdentifier: 'cunning-strike',
};

const replaceCardEvent = vi.fn(async (..._args: unknown[]) => true);
const addCardEvents = vi.fn(async (..._args: unknown[]) => true);
const askActiveGm = vi.fn(async (..._args: unknown[]): Promise<unknown> => true);
let state = { previous: null as number[] | null, usesBack: false };
const settleCritDiceSave = vi.fn(async (..._args: unknown[]) => {});

// Setup loads these modules before a hoisted mock could apply.
vi.resetModules();
const cardEvents = await vi.importActual<typeof import('#utils/chat/cardEvents.js')>(
	'#utils/chat/cardEvents.js',
);
vi.doMock('#utils/chat/cardEvents.js', () => ({ ...cardEvents, addCardEvents, replaceCardEvent }));
vi.doMock('#utils/askActiveGm.js', () => ({ askActiveGm }));
vi.doMock('#utils/rolls/critDiceSaveSettle.js', () => ({
	critDiceSaveState: () => state,
	settleCritDiceSave,
}));
const { canSettleCritDiceLine, settleCritDiceLine, showCritDiceSaveLine } = await import(
	'../critDiceSaveLine.js'
);

const hero = { uuid: 'Actor.hero', name: 'Hero', isOwner: false };
let saveCard: {
	id: string;
	flags: Record<string, any>;
	getFlag(scope: string, key: string): unknown;
};
const game = (globalThis as unknown as { game: Record<string, unknown> }).game;

const placedLine = () => (saveCard.flags[SYSTEM_ID]?.events ?? [])[0] as CardEvent;
const addedLine = () => (addCardEvents.mock.calls[0] as [unknown, CardEvent[]])[1][0];
const replacedWith = () => replaceCardEvent.mock.calls.at(-1)?.[2] as CardEvent | null;

beforeEach(() => {
	vi.clearAllMocks();
	state = { previous: null, usesBack: false };
	hero.isOwner = false;
	saveCard = {
		id: 'save',
		flags: { [SYSTEM_ID]: { critDiceSave: LINK } },
		getFlag: (_scope: string, key: string) => saveCard.flags[SYSTEM_ID][key],
	};
	game.user = { id: 'gm', isGM: true, isActiveGM: true };
	game.messages = {
		get: (id: string) => (id === 'attack' ? { id: 'attack' } : id === 'save' ? saveCard : null),
		contents: [],
	};
	vi.stubGlobal('fromUuidSync', (uuid: string) => (uuid === hero.uuid ? hero : null));
});

afterEach(() => vi.unstubAllGlobals());

describe('showCritDiceSaveLine', () => {
	it('a fail gives a waiting line that sets the dice to their max', async () => {
		await showCritDiceSaveLine(saveCard, LINK, 'fail');

		expect(addedLine()).toEqual(
			expect.objectContaining({
				id: 'critDiceSave.save',
				kind: 'critDiceSave',
				text: { key: 'NIMBLE.chat.critDiceSave.max', data: { name: 'Hero' } },
				cause: { key: 'NIMBLE.chat.critDiceSave.cause.fail' },
				action: {
					kind: 'critDiceSave',
					actorUuid: 'Actor.hero',
					actorName: 'Hero',
					saveMessageId: 'save',
					outcome: 'fail',
					state: 'waiting',
				},
			}),
		);
		expect(settleCritDiceSave).not.toHaveBeenCalled();
	});

	it('a pass gives a waiting line that gives the use back', async () => {
		await showCritDiceSaveLine(saveCard, LINK, 'pass');

		expect(addedLine().text).toEqual({
			key: 'NIMBLE.chat.critDiceSave.useBack',
			data: { name: 'Hero' },
		});
	});

	it('a reroll that changes the result changes the line in its place', async () => {
		await showCritDiceSaveLine(saveCard, LINK, 'fail');
		saveCard.flags[SYSTEM_ID].events = [addedLine()];

		await showCritDiceSaveLine(saveCard, LINK, 'pass');

		expect(addCardEvents).toHaveBeenCalledOnce();
		expect(replaceCardEvent).toHaveBeenCalledWith(
			saveCard,
			'critDiceSave.save',
			expect.objectContaining({
				text: { key: 'NIMBLE.chat.critDiceSave.useBack', data: { name: 'Hero' } },
				at: placedLine().at,
			}),
		);
	});

	it('after the dice were set to their max, a pass also puts the dice back', async () => {
		state = { previous: [2, 3], usesBack: false };

		await showCritDiceSaveLine(saveCard, LINK, 'pass');

		expect(addedLine().text.key).toBe('NIMBLE.chat.critDiceSave.useBackAndDice');
		expect((addedLine().action as CritDiceSaveAction).restoresDice).toBe(true);
	});

	it('after the use came back, a fail also spends it again', async () => {
		state = { previous: null, usesBack: true };

		await showCritDiceSaveLine(saveCard, LINK, 'fail');

		expect(addedLine().text.key).toBe('NIMBLE.chat.critDiceSave.maxAndSpend');
		expect((addedLine().action as CritDiceSaveAction).spendsUse).toBe(true);
	});

	it('a result that matches what a click did shows the line as done', async () => {
		await showCritDiceSaveLine(saveCard, LINK, 'fail');
		saveCard.flags[SYSTEM_ID].events = [addedLine()];
		state = { previous: [2, 3], usesBack: false };

		await showCritDiceSaveLine(saveCard, LINK, 'fail');

		expect(replacedWith()?.text.key).toBe('NIMBLE.chat.critDiceSave.maxDone');
		expect((replacedWith()?.action as CritDiceSaveAction).state).toBe('done');
	});

	it('a result no longer known takes off a line that changed nothing', async () => {
		await showCritDiceSaveLine(saveCard, LINK, 'fail');
		saveCard.flags[SYSTEM_ID].events = [addedLine()];

		await showCritDiceSaveLine(saveCard, LINK, 'unknown');

		expect(replaceCardEvent).toHaveBeenLastCalledWith(saveCard, 'critDiceSave.save', null);
	});

	it('a result no longer known after a click asks to take back the change', async () => {
		state = { previous: [2, 3], usesBack: false };

		await showCritDiceSaveLine(saveCard, LINK, 'unknown');

		expect(addedLine().text.key).toBe('NIMBLE.chat.critDiceSave.takeBack');
	});
});

describe('settleCritDiceLine', () => {
	async function waitingLine(outcome: 'pass' | 'fail' = 'fail') {
		await showCritDiceSaveLine(saveCard, LINK, outcome);
		const line = addedLine();
		saveCard.flags[SYSTEM_ID].events = [line];
		vi.clearAllMocks();
		return line;
	}

	it('marks the line done while it still waits, then does what the result asks', async () => {
		const line = await waitingLine();

		expect(await settleCritDiceLine(saveCard, line)).toBe(true);

		expect(replaceCardEvent).toHaveBeenCalledWith(
			saveCard,
			line.id,
			expect.objectContaining({
				text: { key: 'NIMBLE.chat.critDiceSave.maxDone', data: { name: 'Hero' } },
				action: expect.objectContaining({ state: 'done' }),
			}),
			{ ifState: 'waiting' },
		);
		expect(settleCritDiceSave).toHaveBeenCalledWith(LINK, 'fail');
	});

	it('a second click finds the line marked and does nothing', async () => {
		const line = await waitingLine();
		replaceCardEvent.mockResolvedValueOnce(false);

		expect(await settleCritDiceLine(saveCard, line)).toBe(false);
		expect(settleCritDiceSave).not.toHaveBeenCalled();
	});

	it('an error puts the line back to waiting', async () => {
		const line = await waitingLine();
		settleCritDiceSave.mockRejectedValueOnce(new Error('locked'));

		await expect(settleCritDiceLine(saveCard, line)).rejects.toThrow('locked');
		expect(replaceCardEvent).toHaveBeenLastCalledWith(saveCard, line.id, line, { ifState: 'done' });
	});

	it('the owner of the creature asks the active GM; another player cannot click', async () => {
		const line = await waitingLine('pass');
		game.user = { id: 'player', isGM: false, isActiveGM: false };
		const action = line.action as CritDiceSaveAction;

		expect(canSettleCritDiceLine(action)).toBe(false);
		expect(await settleCritDiceLine(saveCard, line)).toBe(false);

		hero.isOwner = true;
		expect(canSettleCritDiceLine(action)).toBe(true);
		expect(await settleCritDiceLine(saveCard, line)).toBe(true);
		expect(askActiveGm).toHaveBeenCalledWith(`${SYSTEM_ID}.critDiceSaveLine`, {
			messageId: 'save',
			eventId: line.id,
		});
		expect(settleCritDiceSave).not.toHaveBeenCalled();
	});
});
