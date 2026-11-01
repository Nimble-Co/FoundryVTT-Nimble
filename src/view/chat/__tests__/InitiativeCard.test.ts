const mocks = vi.hoisted(() => ({
	requestIncomingAttackReaction: vi.fn(),
	requestResultRemoval: vi.fn(),
}));

vi.mock('#utils/incomingReactions/incomingAttackReactions.js', () => ({
	INCOMING_REACTION_REJECTED_HOOK: 'nimble.incomingReactionRejected',
	requestIncomingAttackReaction: mocks.requestIncomingAttackReaction,
	requestResultRemoval: mocks.requestResultRemoval,
}));

import { fireEvent, render, screen } from '@testing-library/svelte';
import InitiativeCard from '../InitiativeCard.svelte';

type Globals = Record<string, any>;
const globals = globalThis as Globals;

const ROLLER = 'Actor.pip';

let cost: Record<string, unknown>;

const DOCUMENTS: Record<string, () => unknown> = {
	[ROLLER]: () => ({
		name: 'Pip',
		isOwner: true,
		system: { attributes: { wounds: { value: 0, max: 6 } } },
	}),
	'Item.cheat': () => ({
		name: 'Cheat!',
		rules: new Map([
			[
				'rule-cheat',
				{ type: 'changeResult', id: 'rule-cheat', disabled: false, rollUseCost: cost },
			],
		]),
	}),
};

function entry() {
	return {
		id: 'entry-cheat',
		kind: 'reroll',
		source: 'rule',
		actorUuid: ROLLER,
		tokenUuid: null,
		targetTokenUuid: null,
		side: 'roller',
		label: 'rule label',
		ruleId: 'rule-cheat',
		itemUuid: 'Item.cheat',
		used: false,
		use: 'result',
	};
}

function setTen(overrides: Record<string, unknown> = {}) {
	return {
		id: 'click-1',
		lineId: 'click-1',
		entryId: 'entry-cheat',
		itemUuid: 'Item.cheat',
		ruleId: 'rule-cheat',
		label: 'rule label',
		actorUuid: ROLLER,
		change: 'setTotal',
		value: 10,
		stat: '',
		retired: false,
		before: null,
		chargePoolIdentifier: '',
		paid: { charges: 0, mana: 0, wounds: 0 },
		...overrides,
	};
}

let messageCount = 0;

function createMessage(system: Record<string, unknown> = {}, d20 = 5, total = 7) {
	messageCount += 1;
	const message = {
		id: `initiative-${messageCount}`,
		type: 'initiative',
		timestamp: 0,
		author: { color: '#336699' },
		speakerActor: { uuid: ROLLER },
		system: {
			actorName: 'Pip',
			actorType: 'character',
			permissions: 0,
			rollMode: 0,
			actorUuid: ROLLER,
			tokenUuid: null,
			incomingReactions: [entry()],
			resultChanges: [],
			rerolls: [],
			...system,
		},
		rolls: [{ total, dice: [], terms: [{ faces: 20, results: [{ result: d20, active: true }] }] }],
		reactive: null as unknown,
		canStillUseReroll: vi.fn(() => true),
		resultUseOf: vi.fn(() => ({ change: 'setTotal', value: 10, stat: '' })),
		delete: vi.fn(),
	};
	message.reactive = message;
	return message;
}

function renderCard(message = createMessage()) {
	render(InitiativeCard, { props: { messageDocument: message as never } });
	return message;
}

const smallLine = () =>
	document.querySelector('.roll__subheading')?.textContent?.replace(/\s+/g, ' ').trim();
const shownTotal = () => document.querySelector('.roll__value')?.textContent?.trim();
const words = (element: Element | null | undefined) =>
	element?.textContent?.replace(/\s+/g, ' ').trim();
const controlButton = () => screen.queryByRole('button', { name: /^Change This Roll/ });

async function openControl(): Promise<void> {
	const button = controlButton() as HTMLElement;
	if (button.getAttribute('aria-expanded') !== 'true') await fireEvent.click(button);
}

let previous: Record<string, unknown>;

beforeEach(() => {
	previous = {
		user: globals.game.user,
		timeSince: globals.foundry.utils.timeSince,
		settings: globals.game.settings,
	};
	cost = { chargePoolIdentifier: '', chargeCost: 1, manaCost: 0, woundCost: 0, heroicReaction: '' };
	vi.stubGlobal(
		'fromUuidSync',
		vi.fn((uuid: string) => DOCUMENTS[uuid]?.() ?? null),
	);
	globals.game.user = { isGM: false, id: 'player' };
	globals.foundry.utils.timeSince = () => 'now';
	vi.stubGlobal('Hooks', { on: vi.fn(() => 1), off: vi.fn() });
	globals.game.settings = { get: (_scope: string, key: string) => key !== 'autoExpandRolls' };
});

afterEach(() => {
	vi.unstubAllGlobals();
	globals.game.user = previous.user;
	globals.foundry.utils.timeSince = previous.timeSince;
	globals.game.settings = previous.settings;
});

describe('the small line of an Initiative card', () => {
	it.each([
		[5, 7, 'Start with 1 action'],
		[12, 14, 'Start with 2 actions'],
		[18, 20, 'Start with 3 actions'],
		[20, 19, 'Start with 3 actions'],
	])('a d20 of %i and a total of %i says %s', (d20, total, line) => {
		renderCard(createMessage({ incomingReactions: [] }, d20, total));

		expect(smallLine()).toBe(line);
	});

	it('has no result colour', () => {
		renderCard(createMessage({ incomingReactions: [] }));

		expect(document.querySelector('.roll__result')).toBeNull();
	});

	it('names the card Initiative', () => {
		renderCard(createMessage({ incomingReactions: [] }));

		expect(words(document.querySelector('.roll__label'))).toBe('Initiative');
	});

	it('shows the roll mode after it', () => {
		renderCard(createMessage({ incomingReactions: [], rollMode: 1 }));

		expect(smallLine()).toBe('Start with 1 action Advantage × 1');
	});

	it('does not show for a creature that is not a character', () => {
		renderCard(createMessage({ incomingReactions: [], actorType: 'npc' }));

		expect(smallLine()).toBeUndefined();
	});

	it('follows the total after a change', () => {
		renderCard(createMessage({ incomingReactions: [], resultChanges: [setTen()] }));

		expect(shownTotal()).toBe('10');
		expect(smallLine()).toBe('Start with 2 actions');
	});
});

describe('Change This Roll on an Initiative card', () => {
	const rowText = () => words(document.querySelector('.nimble-change-roll__row'));

	it('tells the gain in the cost column of a rule with no other cost', async () => {
		renderCard();
		await openControl();

		expect(rowText()).toContain('Change to 10');
		expect(rowText()).toContain('with Cheat!');
		expect(rowText()).toContain('Start with 2 actions');
		expect(screen.getByRole('button', { name: /Start with 2 actions/ })).toBeTruthy();
	});

	it('keeps the cost words of a rule that has a cost', async () => {
		cost = { ...cost, woundCost: 1 };
		renderCard();
		await openControl();

		expect(rowText()).toContain('Gain 1 Wound');
		expect(rowText()).not.toContain('Start with');
	});

	it('tells no gain for a creature that is not a character', async () => {
		renderCard(createMessage({ actorType: 'npc' }));
		await openControl();

		expect(rowText()).not.toContain('Start with');
	});

	it('opens by itself: Initiative has rows only when a change can help', () => {
		renderCard();

		expect(controlButton()?.getAttribute('aria-expanded')).toBe('true');
	});

	it('has no control when the card says the row cannot apply', () => {
		const message = createMessage();
		message.canStillUseReroll.mockReturnValue(false);
		renderCard(message);

		expect(controlButton()).toBeNull();
	});

	it('tells the change in the history, with Remove', () => {
		renderCard(createMessage({ incomingReactions: [], resultChanges: [setTen()] }));

		expect(words(document.querySelector('.nimble-result-line__text'))).toBe(
			'Changed 7 to 10 with Cheat!',
		);
		expect(screen.getByRole('button', { name: /^Remove: Changed 7 to 10/ })).toBeTruthy();
	});

	it('sends a click to the GM path', async () => {
		mocks.requestIncomingAttackReaction.mockResolvedValue(true);
		renderCard();
		await openControl();

		await fireEvent.click(screen.getByRole('button', { name: /Start with 2 actions/ }));

		expect(mocks.requestIncomingAttackReaction).toHaveBeenCalled();
	});
});
