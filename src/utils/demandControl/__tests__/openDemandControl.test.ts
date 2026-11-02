import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const globals = globalThis as unknown as Record<string, any>;
let savedChatMessage: unknown;

function hero() {
	let stored: object | undefined;
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
	};
}

async function open(choice: object, paid: object | null = {}) {
	vi.resetModules();
	const payRerollCost = vi.fn(async () => paid);
	vi.doMock('#documents/dialogs/DemandControlDialog.svelte.js', () => ({
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
		payRerollCost,
	}));
	const { openDemandControl } = await import('../openDemandControl.js');
	const { chosenOptions, reactionUsedThisRound } = await import('../demandControl.js');
	const actor = hero();
	await openDemandControl(actor as never);
	return { actor, payRerollCost, chosenOptions, reactionUsedThisRound };
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
		vi.doUnmock('#documents/dialogs/DemandControlDialog.svelte.js');
		vi.doUnmock('../../reroll/rerollCost.js');
	});

	it('pays 1 action and uses up no heroic reaction', async () => {
		const { actor, payRerollCost, reactionUsedThisRound } = await open({
			option: 'no',
			asReaction: true,
		});

		expect(payRerollCost).toHaveBeenCalledWith(
			actor,
			expect.objectContaining({ actionCost: 1, heroicReaction: '' }),
		);
		expect(reactionUsedThisRound(actor as never)).toBe(true);
	});

	it('pays nothing with no tick', async () => {
		const { actor, payRerollCost, reactionUsedThisRound } = await open({ option: 'no' });

		expect(payRerollCost).not.toHaveBeenCalled();
		expect(reactionUsedThisRound(actor as never)).toBe(false);
	});

	it('does nothing when the cost is not paid', async () => {
		const { actor, chosenOptions, reactionUsedThisRound } = await open(
			{ option: 'no', asReaction: true },
			null,
		);

		expect(chosenOptions(actor as never)).toEqual([]);
		expect(reactionUsedThisRound(actor as never)).toBe(false);
		expect(globals.ui.notifications.warn).toHaveBeenCalled();
	});
});
