const mocks = vi.hoisted(() => ({ requestIncomingAttackReaction: vi.fn() }));

vi.mock('#utils/incomingReactions/incomingAttackReactions.js', () => ({
	INCOMING_REACTION_REJECTED_HOOK: 'nimble.incomingReactionRejected',
	requestIncomingAttackReaction: mocks.requestIncomingAttackReaction,
}));
vi.mock('../components/confirmRerollHeroicReaction.js', () => ({
	confirmRerollHeroicReaction: vi.fn(async () => false),
}));

import { fireEvent, render, screen, within } from '@testing-library/svelte';
import AbilityCheckCard from '../AbilityCheckCard.svelte';
import SavingThrowCard from '../SavingThrowCard.svelte';
import SkillCheckCard from '../SkillCheckCard.svelte';

const { requestIncomingAttackReaction } = mocks;

type Globals = Record<string, any>;
const globals = globalThis as Globals;

const ROLLER = 'Actor.kael';

let rerollCost: Record<string, unknown>;
let rollerIsOwner: boolean;

function rule(id: string) {
	return { type: 'reroll', id, disabled: false, rerollCost };
}

const DOCUMENTS: Record<string, () => unknown> = {
	[ROLLER]: () => ({
		name: 'Kael',
		isOwner: rollerIsOwner,
		system: { attributes: { wounds: { value: 0, max: 6 } } },
	}),
	'Item.brutality': () => ({
		name: 'Unstoppable Brutality',
		rules: new Map([['rule-brutality', rule('rule-brutality')]]),
	}),
	'Item.luck': () => ({ name: 'Lucky', rules: new Map([['rule-luck', rule('rule-luck')]]) }),
	'Item.seer': () => ({
		name: 'Soothsayer',
		rules: new Map([['rule-seer', { ...rule('rule-seer'), type: 'changeDie' }]]),
	}),
};

function rerollEntry(overrides: Record<string, unknown> = {}) {
	return {
		id: 'entry-brutality',
		kind: 'reroll',
		source: 'rule',
		actorUuid: ROLLER,
		tokenUuid: null,
		targetTokenUuid: null,
		side: 'roller',
		label: 'Unstoppable Brutality rule',
		ruleId: 'rule-brutality',
		itemUuid: 'Item.brutality',
		used: false,
		...overrides,
	};
}

function luckEntry() {
	return rerollEntry({
		id: 'entry-luck',
		label: 'Lucky rule',
		ruleId: 'rule-luck',
		itemUuid: 'Item.luck',
	});
}

function changeEntry() {
	return rerollEntry({
		id: 'entry-seer',
		label: 'Soothsayer rule',
		ruleId: 'rule-seer',
		itemUuid: 'Item.seer',
		use: 'change',
	});
}

function rerollRecord() {
	return {
		entryId: 'entry-brutality',
		itemUuid: 'Item.brutality',
		ruleId: 'rule-brutality',
		label: 'Unstoppable Brutality rule',
		actorUuid: ROLLER,
		faces: 20,
		previous: { value: 6, outcome: null },
		next: { value: 14, outcome: null },
		usesLeft: null,
		woundsGained: 1,
	};
}

function createMessage(system: Record<string, unknown> = {}) {
	const message = {
		id: 'message-1',
		timestamp: 0,
		author: { color: '#336699' },
		speakerActor: { uuid: ROLLER },
		system: {
			actorName: 'Kael',
			// No dice tooltip, so the test needs no real roll.
			actorType: 'npc',
			permissions: 0,
			rollMode: 0,
			saveKey: 'strength',
			skillKey: 'might',
			abilityKey: 'strength',
			actorUuid: ROLLER,
			tokenUuid: null,
			incomingReactions: [rerollEntry()],
			rerolls: [],
			...system,
		},
		rolls: [{ total: 6, terms: [], formula: '1d20' }],
		reactive: null as unknown,
		canStillUseReroll: vi.fn(() => true),
		delete: vi.fn(),
	};
	message.reactive = message;
	return message;
}

function renderSave(message = createMessage()) {
	render(SavingThrowCard, { props: { messageDocument: message as never } });
	return message;
}

const rollRow = () => document.querySelector('.roll') as HTMLElement;
const rerollButton = () => within(rollRow()).queryByRole('button', { name: /Reroll|reroll/ });

async function settle() {
	for (let i = 0; i < 4; i += 1) await Promise.resolve();
}

let previous: Record<string, unknown>;

beforeEach(() => {
	previous = {
		user: globals.game.user,
		timeSince: globals.foundry.utils.timeSince,
		settings: globals.game.settings,
	};
	rerollCost = {
		chargePoolIdentifier: '',
		chargeCost: 1,
		manaCost: 0,
		woundCost: 1,
		heroicReaction: '',
	};
	rollerIsOwner = true;
	requestIncomingAttackReaction.mockResolvedValue(true);
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

describe('rerolls on check cards', () => {
	it.each([
		['saving throw', SavingThrowCard],
		['skill check', SkillCheckCard],
		['ability check', AbilityCheckCard],
	])('puts a reroll button in the roll row of a %s card', (_name, Card) => {
		render(Card, { props: { messageDocument: createMessage() as never } });

		const button = rerollButton();
		expect(button?.getAttribute('aria-label')).toBe('Reroll with Unstoppable Brutality (1 Wound)');
		expect(button?.dataset.tooltip).toBe('Reroll with Unstoppable Brutality (1 Wound)');
	});

	it('shows the button to the GM when the GM does not own the roller', () => {
		rollerIsOwner = false;
		globals.game.user = { isGM: true, id: 'gm' };
		renderSave();

		expect(rerollButton()).not.toBeNull();
	});

	it('shows no button to a player who does not own the roller', () => {
		rollerIsOwner = false;
		renderSave();

		expect(rerollButton()).toBeNull();
	});

	it('shows no button when the card says the reroll can no longer be used', () => {
		const message = createMessage();
		message.canStillUseReroll.mockReturnValue(false);
		renderSave(message);

		expect(message.canStillUseReroll).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'entry-brutality' }),
		);
		expect(rerollButton()).toBeNull();
	});

	it('rerolls with one click through the reaction path', async () => {
		renderSave();

		await fireEvent.click(rerollButton() as HTMLElement);
		await settle();

		expect(requestIncomingAttackReaction).toHaveBeenCalledWith({
			messageId: 'message-1',
			entryId: 'entry-brutality',
			forceHeroicReaction: false,
		});
	});

	it('gives the focus back to the reroll button when the die picker closes', async () => {
		const message = Object.assign(createMessage(), {
			rerollDiceToPick: vi.fn(() => [
				{ term: 0, result: 0, faces: 20, value: 6, role: 'primary' },
				{ term: 0, result: 1, faces: 20, value: 3, role: 'dropped' },
			]),
		});
		renderSave(message);

		await fireEvent.click(rerollButton() as HTMLElement);
		await settle();
		await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
		await settle();
		expect(document.activeElement).toBe(rerollButton());

		await fireEvent.click(rerollButton() as HTMLElement);
		await settle();
		await fireEvent.keyDown(screen.getByRole('button', { name: 'Cancel' }), { key: 'Escape' });
		await settle();
		expect(document.activeElement).toBe(rerollButton());
	});

	describe('with two features', () => {
		const message = () => createMessage({ incomingReactions: [rerollEntry(), luckEntry()] });

		it('opens a list of the features, each with its cost', async () => {
			renderSave(message());

			const button = rerollButton() as HTMLElement;
			expect(button.getAttribute('aria-label')).toBe('Choose a feature to reroll with');
			expect(button.getAttribute('aria-haspopup')).toBe('menu');
			expect(button.getAttribute('aria-expanded')).toBe('false');
			expect(screen.queryByRole('menu')).toBeNull();

			await fireEvent.click(button);

			expect(button.getAttribute('aria-expanded')).toBe('true');
			const menu = screen.getByRole('menu');
			const items = within(menu).getAllByRole('menuitem');
			expect(items.map((item) => item.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
				'Unstoppable Brutality 1 Wound',
				'Lucky 1 Wound',
			]);
			expect(items.map((item) => item.getAttribute('aria-label'))).toEqual([
				'Reroll with Unstoppable Brutality (1 Wound)',
				'Reroll with Lucky (1 Wound)',
			]);
			expect(
				[...menu.querySelectorAll('.nimble-choice-menu__heading')].map((h) => h.textContent),
			).toEqual(['Reroll']);
			expect(document.activeElement).toBe(items[0]);
			expect(requestIncomingAttackReaction).not.toHaveBeenCalled();
		});

		it('scrolls the whole list into view, so the last feature is not under the chat input', async () => {
			const scrollIntoView = vi.fn();
			Element.prototype.scrollIntoView = scrollIntoView;
			try {
				renderSave(message());

				await fireEvent.click(rerollButton() as HTMLElement);

				expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
				expect(scrollIntoView.mock.contexts[0]).toBe(screen.getByRole('menu'));
			} finally {
				delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
			}
		});

		it('rerolls with the feature picked in the list', async () => {
			renderSave(message());

			await fireEvent.click(rerollButton() as HTMLElement);
			await fireEvent.click(screen.getByRole('menuitem', { name: /Lucky/ }));
			await settle();

			expect(requestIncomingAttackReaction).toHaveBeenCalledWith({
				messageId: 'message-1',
				entryId: 'entry-luck',
				forceHeroicReaction: false,
			});
			expect(screen.queryByRole('menu')).toBeNull();
		});

		it('moves through the list with the arrow keys and closes it with Escape', async () => {
			renderSave(message());

			const button = rerollButton() as HTMLElement;
			await fireEvent.click(button);
			const items = screen.getAllByRole('menuitem');

			await fireEvent.keyDown(items[0], { key: 'ArrowDown' });
			expect(document.activeElement).toBe(items[1]);
			await fireEvent.keyDown(items[1], { key: 'ArrowDown' });
			expect(document.activeElement).toBe(items[0]);

			await fireEvent.keyDown(items[0], { key: 'Escape' });
			expect(screen.queryByRole('menu')).toBeNull();
			expect(document.activeElement).toBe(button);
		});

		it("keeps Escape from also opening Foundry's main menu", async () => {
			const windowKeydown = vi.fn();
			window.addEventListener('keydown', windowKeydown);
			try {
				renderSave(message());
				await fireEvent.click(rerollButton() as HTMLElement);

				await fireEvent.keyDown(screen.getAllByRole('menuitem')[0], { key: 'Escape' });

				expect(windowKeydown).not.toHaveBeenCalled();
			} finally {
				window.removeEventListener('keydown', windowKeydown);
			}
		});
	});

	describe('with a Change a Die feature', () => {
		const d20 = { term: 0, result: 0, faces: 20, value: 6, role: 'kept' };

		function changeMessage(incomingReactions: unknown[]) {
			return Object.assign(createMessage({ incomingReactions }), {
				changeToPick: vi.fn(() => ({ setsValue: true, dice: [d20] })),
			});
		}

		it('puts the rerolls and the changes under their own headings', async () => {
			renderSave(changeMessage([rerollEntry(), changeEntry()]));

			const button = rerollButton() as HTMLElement;
			expect(button.getAttribute('aria-label')).toBe(
				'Choose a feature to reroll or change the die',
			);
			await fireEvent.click(button);

			const menu = screen.getByRole('menu');
			expect(
				[...menu.querySelectorAll('.nimble-choice-menu__heading')].map((h) => h.textContent),
			).toEqual(['Reroll', 'Change a die']);
			const change = within(menu).getByRole('menuitem', {
				name: 'Change the die with Soothsayer (1 Wound)',
			});
			expect(change.querySelector('.fa-pen')).toBeTruthy();
		});

		it('names the one change on the button, and opens the value picker in place', async () => {
			renderSave(changeMessage([changeEntry()]));

			const button = screen.getByRole('button', {
				name: 'Change the die with Soothsayer (1 Wound)',
			});
			expect(button.querySelector('.fa-pen')).toBeTruthy();
			await fireEvent.click(button);
			await settle();

			expect(screen.getByText('Pick a value')).toBeTruthy();
			expect(screen.getByRole('img', { name: 'Was 6' })).toBeTruthy();
			await fireEvent.click(screen.getByRole('button', { name: '20 (highest)' }));
			await fireEvent.click(screen.getByRole('button', { name: 'Set to 20' }));
			await settle();

			expect(requestIncomingAttackReaction).toHaveBeenCalledWith({
				messageId: 'message-1',
				entryId: 'entry-seer',
				forceHeroicReaction: false,
				die: { term: 0, result: 0 },
				value: 20,
			});
		});

		it('gives the focus back to the button when the value picker closes', async () => {
			renderSave(changeMessage([changeEntry()]));
			const button = () =>
				screen.getByRole('button', { name: 'Change the die with Soothsayer (1 Wound)' });

			await fireEvent.click(button());
			await settle();
			await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
			await settle();

			expect(screen.queryByText('Pick a value')).toBeNull();
			expect(document.activeElement).toBe(button());
		});
	});

	it('shows the reroll history under the roll row, with the old and the new d20', () => {
		renderSave(
			createMessage({
				incomingReactions: [rerollEntry({ used: true })],
				rerolls: [rerollRecord()],
			}),
		);

		const history = document.querySelector('.nimble-roll-changes') as HTMLElement;
		expect(rollRow().compareDocumentPosition(history)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
		expect(within(history).getByText('Rerolled with Unstoppable Brutality')).toBeTruthy();
		expect(within(history).getByText('Wounds gained: 1')).toBeTruthy();
		expect(within(history).getByRole('img', { name: 'Was 6' })).toBeTruthy();
		expect(within(history).getByRole('img', { name: 'Now 14' })).toBeTruthy();
		expect(history.querySelectorAll('.nimble-die-face--d20')).toHaveLength(2);
		expect(rerollButton()).toBeNull();
	});

	it('shows no button and no history on a card posted before rerolls', () => {
		const message = createMessage();
		message.system = {
			actorName: 'Kael',
			// No dice tooltip, so the test needs no real roll.
			actorType: 'npc',
			permissions: 0,
			rollMode: 0,
			saveKey: 'strength',
		} as never;
		renderSave(message);

		expect(rollRow()).not.toBeNull();
		expect(rerollButton()).toBeNull();
		expect(document.querySelector('.nimble-roll-changes')).toBeNull();
	});
});
