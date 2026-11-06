import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const globals = globalThis as unknown as Record<string, any>;
let savedChatMessage: unknown;

function hero() {
	let stored: object | undefined;
	return {
		uuid: 'Actor.mage',
		name: 'Mage',
		isOwner: true,
		rules: [{ type: 'optionWindow', optionSet: 'control', appliesTo: () => true }],
		items: [],
		getFlag: () => stored,
		setFlag: vi.fn(async (_scope: string, _key: string, value: object) => {
			stored = value;
		}),
	};
}

async function open(choice: object, paid: object | null = {}, actor = hero()) {
	vi.resetModules();
	const payCost = vi.fn(async () => paid);
	const giveBack = vi.fn(async () => undefined);
	vi.doMock('#documents/dialogs/ChoiceDialog.svelte.js', () => ({
		default: class {
			promise = Promise.resolve(choice);
			render = vi.fn(async () => undefined);
		},
	}));
	vi.doMock('../../reroll/rerollCost.js', () => ({
		chargeOnlyCost: (chargePoolIdentifier: string) => ({
			chargePoolIdentifier,
			chargeCost: 0,
			manaCost: 0,
			woundCost: 0,
			heroicReaction: '',
		}),
	}));
	vi.doMock('../../cost/costLedger.js', () => ({ payCost, giveBack }));
	const { openDemandControl } = await import('../openDemandControl.js');
	const { chosenOptions, reactionUsedThisRound } = await import('../demandControl.js');
	await openDemandControl(actor);
	return { actor, payCost, giveBack, chosenOptions, reactionUsedThisRound };
}

describe('openDemandControl with the Reaction tick', () => {
	beforeEach(() => {
		globals.game.combat = { id: 'c', started: true, round: 2 };
		globals.ui.notifications = { warn: vi.fn(), info: vi.fn() };
		savedChatMessage = globals.ChatMessage;
		globals.ChatMessage = {
			create: vi.fn(async () => ({})),
			getSpeaker: vi.fn(() => ({})),
			getWhisperRecipients: vi.fn(() => []),
		};
	});

	afterEach(() => {
		delete globals.game.combat;
		globals.ChatMessage = savedChatMessage;
		vi.doUnmock('#documents/dialogs/ChoiceDialog.svelte.js');
		vi.doUnmock('../../reroll/rerollCost.js');
		vi.doUnmock('../../cost/costLedger.js');
	});

	it('pays 1 action and uses up no heroic reaction', async () => {
		const { actor, payCost, reactionUsedThisRound } = await open({
			option: 'no',
			asReaction: true,
		});

		expect(payCost).toHaveBeenCalledWith(
			actor,
			expect.objectContaining({ actionCost: 1, heroicReaction: '' }),
		);
		expect(reactionUsedThisRound(actor)).toBe(true);
	});

	it('pays nothing with no tick', async () => {
		const { actor, payCost, reactionUsedThisRound } = await open({ option: 'no' });

		expect(payCost).not.toHaveBeenCalled();
		expect(reactionUsedThisRound(actor)).toBe(false);
	});

	it('does nothing when the cost is not paid', async () => {
		const { actor, chosenOptions, reactionUsedThisRound } = await open(
			{ option: 'no', asReaction: true },
			null,
		);

		expect(chosenOptions(actor)).toEqual([]);
		expect(reactionUsedThisRound(actor)).toBe(false);
		expect(globals.ui.notifications.warn).toHaveBeenCalled();
	});

	it('gives the action back and records nothing when the cantrip window is closed', async () => {
		const actor = hero();
		const { chosenOptions, reactionUsedThisRound, giveBack } = await open(
			{ option: 'iInsist', cantripId: 'a', asReaction: true },
			{},
			actor,
		);

		expect(giveBack).toHaveBeenCalled();
		expect(chosenOptions(actor)).toEqual([]);
		expect(reactionUsedThisRound(actor)).toBe(false);
	});
});
