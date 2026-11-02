import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	applyControlChoice,
	cantripsOf,
	choiceIsComplete,
	chosenAfter,
	chosenOptions,
	optionRows,
	recordChoice,
	resetChosen,
	saveRowActor,
	usedThisRound,
} from '../demandControl.js';

const globals = globalThis as unknown as Record<string, any>;

function hero(state?: object, extra: object = {}) {
	let stored = state;
	return {
		uuid: 'Actor.mage',
		name: 'Mage',
		isOwner: true,
		rules: [],
		items: [],
		getFlag: () => stored,
		setFlag: vi.fn(async (_scope: string, _key: string, value: object) => {
			stored = value;
		}),
		unsetFlag: vi.fn(async () => {
			stored = undefined;
		}),
		...extra,
	};
}

let savedChatMessage: unknown;

beforeEach(() => {
	savedChatMessage = globals.ChatMessage;
	globals.ChatMessage = {
		create: vi.fn(async () => null),
		getSpeaker: () => ({}),
		getWhisperRecipients: () => [{ id: 'gm' }],
	};
});

afterEach(() => {
	globals.ChatMessage = savedChatMessage;
	delete globals.fromUuidSync;
	delete globals.game.combat;
});

describe('the Control Table list', () => {
	it('dims what was chosen', () => {
		const rows = optionRows(hero({ chosen: ['no'] }));
		expect(rows.map((row) => row.chosen)).toEqual([false, false, true, false]);
		expect(rows[0].label).toBe('I INSIST');
	});

	it('starts again when all options were chosen (H:957)', () => {
		expect(chosenAfter(['iInsist', 'no', 'loseControl'], 'elementalAffliction')).toEqual([]);
		expect(chosenAfter(['iInsist'], 'no')).toEqual(['iInsist', 'no']);
	});

	it('keeps the choice on the actor', async () => {
		const actor = hero();
		await recordChoice(actor, 'no');
		expect(chosenOptions(actor)).toEqual(['no']);
	});

	it('resets at Initiative', async () => {
		const actor = hero({ chosen: ['no'] });
		await resetChosen(actor);
		expect(actor.unsetFlag).toHaveBeenCalled();
	});

	it('reports a second use in a round', async () => {
		globals.game.combat = { id: 'c', started: true, round: 2 };
		const actor = hero();
		expect(usedThisRound(actor)).toBe(false);
		await recordChoice(actor, 'no', true);
		expect(usedThisRound(actor)).toBe(true);
		globals.game.combat.round = 3;
		expect(usedThisRound(actor)).toBe(false);
	});

	it('does not count a use from a feature with no limit in a round', async () => {
		globals.game.combat = { id: 'c', started: true, round: 2 };
		const actor = hero();
		await recordChoice(actor, 'no');
		expect(usedThisRound(actor)).toBe(false);
	});
});

describe('the window', () => {
	it('lists the cantrips only', () => {
		const actor = hero(undefined, {
			items: [
				{ id: 'a', name: 'Ice Lance', type: 'spell', system: { tier: 0 } },
				{ id: 'b', name: 'Fireball', type: 'spell', system: { tier: 3 } },
				{ id: 'c', name: 'Sword', type: 'object', system: {} },
			],
		});
		expect(cantripsOf(actor)).toEqual([{ id: 'a', name: 'Ice Lance' }]);
	});

	it('needs what each option asks for', () => {
		expect(choiceIsComplete({ option: 'iInsist' })).toBe(false);
		expect(choiceIsComplete({ option: 'iInsist', cantripId: 'a' })).toBe(true);
		expect(choiceIsComplete({ option: 'elementalAffliction', creatureUuid: 'x' })).toBe(false);
		expect(
			choiceIsComplete({ option: 'elementalAffliction', creatureUuid: 'x', condition: 'slowed' }),
		).toBe(true);
		expect(choiceIsComplete({ option: 'no', creatureUuid: 'x' })).toBe(false);
		expect(choiceIsComplete({ option: 'no', creatureUuid: 'x', protectedUuid: 'y' })).toBe(true);
		expect(choiceIsComplete({ option: 'loseControl' })).toBe(true);
	});
});

describe('the options', () => {
	it('I INSIST casts free, with no disadvantage, and it cannot miss', async () => {
		const activate = vi.fn(async () => null);
		const actor = hero(undefined, {
			items: [{ id: 'a', name: 'Ice Lance', type: 'spell', system: { tier: 0 }, activate }],
		});

		await applyControlChoice(actor, { option: 'iInsist', cantripId: 'a' });

		expect(activate).toHaveBeenCalledWith(
			expect.objectContaining({
				fastForward: true,
				ignoreDisadvantage: true,
				grantedCannotMiss: 'I INSIST',
			}),
		);
		expect(ChatMessage.create).not.toHaveBeenCalledWith(
			expect.objectContaining({ type: 'demandControl' }),
		);
	});

	it('NO names both creatures and applies nothing', async () => {
		globals.fromUuidSync = vi.fn((uuid: string) => ({ name: uuid === 'x' ? 'Ogre' : 'Dagr' }));

		await applyControlChoice(hero(), {
			option: 'no',
			creatureUuid: 'x',
			protectedUuid: 'y',
		});

		expect(ChatMessage.create).toHaveBeenCalledWith(
			expect.objectContaining({
				type: 'demandControl',
				system: expect.objectContaining({
					text: 'Ogre cannot harm Dagr during its next turn.',
				}),
			}),
		);
	});
});

describe('LOSE CONTROL and ELEMENTAL AFFLICTION', () => {
	it('LOSE CONTROL posts a card to the GM', async () => {
		await applyControlChoice(hero(), { option: 'loseControl' });

		expect(ChatMessage.create).toHaveBeenCalledWith(
			expect.objectContaining({
				type: 'demandControl',
				whisper: ['gm'],
				system: expect.objectContaining({ option: 'loseControl' }),
			}),
		);
	});

	it('ELEMENTAL AFFLICTION asks the GM for a creature the player does not own', async () => {
		const query = vi.fn(async () => true);
		const users = globals.game.users;
		globals.game.users = { activeGM: { query } };
		globals.fromUuidSync = vi.fn(() => ({ isOwner: false, name: 'Ogre' }));

		await applyControlChoice(hero(), {
			option: 'elementalAffliction',
			creatureUuid: 'x',
			condition: 'slowed',
		});

		globals.game.users = users;
		expect(query).toHaveBeenCalledWith(
			'nimble.demandControl',
			expect.objectContaining({ action: 'condition', creatureUuid: 'x', condition: 'slowed' }),
		);
		expect(ChatMessage.create).toHaveBeenCalledWith(
			expect.objectContaining({
				system: expect.objectContaining({ text: 'Ogre gains Slowed.' }),
			}),
		);
	});
});

describe('the row on a save card', () => {
	const owner = (cardRow: boolean, isOwner = true) => ({
		isOwner,
		rules: [{ type: 'demandControl', cardRow }],
	});
	const card = (result: string, flags: Record<string, unknown> = { causedBy: 'Actor.mage' }) => ({
		flags: { nimble: flags },
		system: { reportedSaveResult: result },
	});

	it('shows to the owner of the creature when the target saved', () => {
		const actor = owner(true);
		globals.fromUuidSync = vi.fn(() => actor);
		expect(saveRowActor(card('succeeded'))).toBe(actor);
	});

	it('does not show on a failed save, to another user, after use, or with no such rule', () => {
		globals.fromUuidSync = vi.fn(() => owner(true));
		expect(saveRowActor(card('failed'))).toBeNull();
		expect(saveRowActor(card('succeeded', { causedBy: 'a', demandControlUsed: true }))).toBeNull();
		expect(saveRowActor(card('succeeded', {}))).toBeNull();
		globals.fromUuidSync = vi.fn(() => owner(true, false));
		expect(saveRowActor(card('succeeded'))).toBeNull();
		globals.fromUuidSync = vi.fn(() => owner(false));
		expect(saveRowActor(card('succeeded'))).toBeNull();
	});
});
