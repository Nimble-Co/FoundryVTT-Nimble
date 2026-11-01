const mocks = vi.hoisted(() => ({
	requestIncomingAttackReaction: vi.fn(),
	requestResultRemoval: vi.fn(),
}));

vi.mock('#utils/incomingReactions/incomingAttackReactions.js', () => ({
	INCOMING_REACTION_REJECTED_HOOK: 'nimble.incomingReactionRejected',
	requestIncomingAttackReaction: mocks.requestIncomingAttackReaction,
	requestResultRemoval: mocks.requestResultRemoval,
}));
vi.mock('../components/confirmRerollHeroicReaction.js', () => ({
	confirmRerollHeroicReaction: vi.fn(async () => false),
}));

import { fireEvent, render, screen, within } from '@testing-library/svelte';
import AbilityCheckCard from '../AbilityCheckCard.svelte';
import SavingThrowCard from '../SavingThrowCard.svelte';
import SkillCheckCard from '../SkillCheckCard.svelte';

const { requestIncomingAttackReaction, requestResultRemoval } = mocks;

type Globals = Record<string, any>;
const globals = globalThis as Globals;

const ROLLER = 'Actor.kael';

let rerollCost: Record<string, unknown>;
let rollerIsOwner: boolean;

function rule(id: string) {
	return { type: 'reroll', id, disabled: false, rollUseCost: rerollCost };
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
	'Item.soul': () => ({ name: 'Mighty Soul', rules: new Map() }),
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

function resultChange(overrides: Record<string, unknown> = {}) {
	return {
		id: 'click-1',
		lineId: 'click-1',
		entryId: 'entry-result',
		itemUuid: 'Item.soul',
		ruleId: 'rule-soul',
		label: 'rule label',
		actorUuid: ROLLER,
		change: 'add',
		value: 3,
		stat: 'strength',
		retired: false,
		before: null,
		chargePoolIdentifier: '',
		paid: { charges: 0, mana: 0, wounds: 1 },
		...overrides,
	};
}

function resultEntry(use: { change: string; value: number; stat: string }) {
	return { entry: rerollEntry({ id: 'entry-result', use: 'result' }), use };
}

function renderSave(message = createMessage()) {
	render(SavingThrowCard, { props: { messageDocument: message as never } });
	return message;
}

const rollRow = () => document.querySelector('.roll') as HTMLElement;
const controlButton = () => screen.queryByRole('button', { name: /^Change This Roll/ });

/** Opens Change This Roll. It can be open already: its state stays per message id. */
async function openControl(): Promise<void> {
	const button = controlButton() as HTMLElement;
	if (button.getAttribute('aria-expanded') !== 'true') await fireEvent.click(button);
}

const rowsOf = () => [...document.querySelectorAll<HTMLElement>('.nimble-change-roll__row')];
const rowWords = (row: HTMLElement) => row.textContent?.replace(/\s+/g, ' ').trim();
const row = (name: RegExp | string) => screen.getByRole('button', { name });

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
	])('puts Change This Roll under the roll of a %s card', async (_name, Card) => {
		render(Card, { props: { messageDocument: createMessage() as never } });

		const button = controlButton() as HTMLElement;
		expect(rollRow().contains(button)).toBe(false);
		expect(rollRow().compareDocumentPosition(button)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
		await openControl();

		expect(row('Reroll with Unstoppable Brutality (Gain 1 Wound)')).toBeTruthy();
		expect(document.querySelector('.roll__action')).toBeNull();
	});

	it('shows the control to the GM when the GM does not own the roller', () => {
		rollerIsOwner = false;
		globals.game.user = { isGM: true, id: 'gm' };
		renderSave();

		expect(controlButton()).not.toBeNull();
	});

	it('shows no control to a player who does not own the roller', () => {
		rollerIsOwner = false;
		renderSave();

		expect(controlButton()).toBeNull();
	});

	it('shows no control when the card says the reroll can no longer be used', () => {
		const message = createMessage();
		message.canStillUseReroll.mockReturnValue(false);
		renderSave(message);

		expect(message.canStillUseReroll).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'entry-brutality' }),
		);
		expect(controlButton()).toBeNull();
	});

	describe('when it opens by itself', () => {
		let messageNumber = 0;

		function resultMessage(total: number, system: Record<string, unknown>) {
			const message = createMessage({ ...system });
			message.id = `result-message-${(messageNumber += 1)}`;
			Object.assign(message, { type: 'savingThrow' });
			message.rolls = [{ total, terms: [], formula: '1d20' }];
			return message;
		}

		it('opens on a card that says Failed', () => {
			renderSave(resultMessage(6, { dc: 14 }));

			expect(controlButton()?.getAttribute('aria-expanded')).toBe('true');
			expect(rowsOf()).toHaveLength(1);
		});

		it('starts closed on a card that says Succeeded', () => {
			renderSave(resultMessage(16, { dc: 14 }));

			expect(controlButton()?.getAttribute('aria-expanded')).toBe('false');
			expect(rowWords(controlButton() as HTMLElement)).toBe('Change This Roll (1)');
		});

		it('starts closed on a card with no result', () => {
			renderSave(resultMessage(6, {}));

			expect(controlButton()?.getAttribute('aria-expanded')).toBe('false');
		});
	});

	it('rerolls through the reaction path on a click of the row, not of the button', async () => {
		renderSave();

		await openControl();
		expect(requestIncomingAttackReaction).not.toHaveBeenCalled();
		await fireEvent.click(rowsOf()[0]);
		await settle();

		expect(requestIncomingAttackReaction).toHaveBeenCalledWith({
			messageId: 'message-1',
			entryId: 'entry-brutality',
			forceHeroicReaction: false,
		});
	});

	it('gives the focus back to the row when the die picker closes', async () => {
		const message = Object.assign(createMessage(), {
			rerollDiceToPick: vi.fn(() => [
				{ term: 0, result: 0, faces: 20, value: 6, role: 'primary' },
				{ term: 0, result: 1, faces: 20, value: 3, role: 'dropped' },
			]),
		});
		renderSave(message);

		await openControl();
		await fireEvent.click(rowsOf()[0]);
		await settle();
		const title = screen.getByText('Pick a die to reroll');
		expect(rowsOf()[0].compareDocumentPosition(title)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
		await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
		await settle();
		expect(document.activeElement).toBe(rowsOf()[0]);

		await fireEvent.click(rowsOf()[0]);
		await settle();
		await fireEvent.keyDown(screen.getByRole('button', { name: 'Cancel' }), { key: 'Escape' });
		await settle();
		expect(document.activeElement).toBe(rowsOf()[0]);
	});

	describe('with two features', () => {
		let messageNumber = 0;

		function message() {
			const twoFeatures = createMessage({ incomingReactions: [rerollEntry(), luckEntry()] });
			twoFeatures.id = `two-features-${(messageNumber += 1)}`;
			return twoFeatures;
		}

		it('opens a list of the rows, each with its cost', async () => {
			renderSave(message());

			const button = controlButton() as HTMLElement;
			expect(rowWords(button)).toBe('Change This Roll (2)');
			expect(button.getAttribute('aria-expanded')).toBe('false');
			expect(rowsOf()).toHaveLength(0);

			await fireEvent.click(button);

			expect(button.getAttribute('aria-expanded')).toBe('true');
			expect(rowsOf().map(rowWords)).toEqual([
				'Reroll with Unstoppable Brutality Gain 1 Wound',
				'Reroll with Lucky Gain 1 Wound',
			]);
			expect(rowsOf().map((item) => item.getAttribute('aria-label'))).toEqual([
				'Reroll with Unstoppable Brutality (Gain 1 Wound)',
				'Reroll with Lucky (Gain 1 Wound)',
			]);
			expect(requestIncomingAttackReaction).not.toHaveBeenCalled();
		});

		it('scrolls the whole list into view, so the last row is not under the chat input', async () => {
			const scrollIntoView = vi.fn();
			Element.prototype.scrollIntoView = scrollIntoView;
			try {
				renderSave(message());

				await fireEvent.click(controlButton() as HTMLElement);
				await settle();

				expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
				expect(scrollIntoView.mock.contexts[0]).toBe(
					screen.getByRole('group', { name: 'Change This Roll' }),
				);
			} finally {
				delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
			}
		});

		it('rerolls with the row clicked', async () => {
			const card = message();
			renderSave(card);

			await openControl();
			await fireEvent.click(row(/Lucky/));
			await settle();

			expect(requestIncomingAttackReaction).toHaveBeenCalledWith({
				messageId: card.id,
				entryId: 'entry-luck',
				forceHeroicReaction: false,
			});
		});

		it('moves through the rows with the arrow keys and closes with Escape', async () => {
			renderSave(message());

			const button = controlButton() as HTMLElement;
			await fireEvent.click(button);
			const items = rowsOf();

			await fireEvent.keyDown(items[0], { key: 'ArrowDown' });
			expect(document.activeElement).toBe(items[1]);
			await fireEvent.keyDown(items[1], { key: 'ArrowDown' });
			expect(document.activeElement).toBe(items[0]);

			await fireEvent.keyDown(items[0], { key: 'Escape' });
			expect(rowsOf()).toHaveLength(0);
			expect(document.activeElement).toBe(button);
		});

		it("keeps Escape from also opening Foundry's main menu", async () => {
			const windowKeydown = vi.fn();
			window.addEventListener('keydown', windowKeydown);
			try {
				renderSave(message());
				await openControl();

				await fireEvent.keyDown(rowsOf()[0], { key: 'Escape' });

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

		it('lists the rerolls first, then the changes, with no icons', async () => {
			renderSave(changeMessage([changeEntry(), rerollEntry()]));

			await openControl();

			expect(rowsOf().map(rowWords)).toEqual([
				'Reroll with Unstoppable Brutality Gain 1 Wound',
				'Change Die with Soothsayer Gain 1 Wound',
			]);
			expect(rowsOf()[1].querySelector('i')).toBeNull();
			expect(rowsOf()[1].getAttribute('aria-label')).toBe(
				'Change Die with Soothsayer (Gain 1 Wound)',
			);
		});

		it('opens the value picker under its row', async () => {
			renderSave(changeMessage([changeEntry()]));

			await openControl();
			await fireEvent.click(rowsOf()[0]);
			await settle();

			const title = screen.getByText('Pick a value');
			expect(rowsOf()[0].compareDocumentPosition(title)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
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

		it('gives the focus back to the row when the value picker closes', async () => {
			renderSave(changeMessage([changeEntry()]));

			await openControl();
			await fireEvent.click(rowsOf()[0]);
			await settle();
			await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
			await settle();

			expect(screen.queryByText('Pick a value')).toBeNull();
			expect(document.activeElement).toBe(rowsOf()[0]);
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
		expect(controlButton()).toBeNull();
	});

	describe('with Another Stat', () => {
		const statButtons = () => [
			...document.querySelectorAll<HTMLElement>('.nimble-reroll-stats__stat'),
		];
		const STATS = [
			{ stat: 'dexterity', mod: 2 },
			{ stat: 'intelligence', mod: 0 },
			{ stat: 'will', mod: -1 },
		];

		function statMessage(id: string) {
			const message = createMessage({
				incomingReactions: [rerollEntry({ anotherStat: true })],
			});
			Object.assign(message, { id, rerollStatsToPick: vi.fn(() => STATS) });
			return message;
		}

		it('shows the verb, and the click opens the stats under the row with signed modifiers', async () => {
			renderSave(statMessage('stat-open'));
			await openControl();

			expect(rowWords(rowsOf()[0])).toContain('Reroll With Another Stat');
			expect(statButtons()).toEqual([]);

			await fireEvent.click(rowsOf()[0]);
			await settle();

			expect(requestIncomingAttackReaction).not.toHaveBeenCalled();
			expect(statButtons().map((button) => button.textContent?.trim())).toEqual([
				'DEX +2',
				'INT +0',
				'WIL \u22121',
			]);
		});

		it('sends the stat on one click', async () => {
			renderSave(statMessage('stat-send'));
			await openControl();
			await fireEvent.click(rowsOf()[0]);
			await settle();

			await fireEvent.click(statButtons()[0]);
			await settle();

			expect(requestIncomingAttackReaction).toHaveBeenCalledTimes(1);
			expect(requestIncomingAttackReaction.mock.calls[0][0]).toMatchObject({ stat: 'dexterity' });
		});

		it('says on the row whether its stats are open', async () => {
			renderSave(statMessage('stat-expanded'));
			await openControl();
			expect(rowsOf()[0].getAttribute('aria-expanded')).toBe('false');

			await fireEvent.click(rowsOf()[0]);
			await settle();
			expect(rowsOf()[0].getAttribute('aria-expanded')).toBe('true');
		});

		it('has no open state on a row that opens no picker', async () => {
			renderSave(createMessage({ incomingReactions: [rerollEntry()] }));
			await openControl();

			expect(rowsOf()[0].hasAttribute('aria-expanded')).toBe(false);
		});

		it('closes on Escape, keeps the control open, and gives the focus to the row', async () => {
			renderSave(statMessage('stat-escape'));
			await openControl();
			await fireEvent.click(rowsOf()[0]);
			await settle();

			const notClaimed = await fireEvent.keyDown(statButtons()[0], { key: 'Escape' });
			await settle();

			expect(notClaimed).toBe(false);
			expect(statButtons()).toEqual([]);
			expect(controlButton()?.getAttribute('aria-expanded')).toBe('true');
			expect(document.activeElement).toBe(rowsOf()[0]);
			expect(requestIncomingAttackReaction).not.toHaveBeenCalled();
		});

		it('closes on Cancel and gives the focus to the row', async () => {
			renderSave(statMessage('stat-cancel'));
			await openControl();
			await fireEvent.click(rowsOf()[0]);
			await settle();

			await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
			await settle();

			expect(statButtons()).toEqual([]);
			expect(document.activeElement).toBe(rowsOf()[0]);
			expect(requestIncomingAttackReaction).not.toHaveBeenCalled();
		});
	});

	describe('with Change a Result', () => {
		const shownTotal = () => document.querySelector('.roll__value')?.textContent;
		const sumBox = () => document.querySelector('.nimble-result-sum')?.textContent;
		const removeButton = () => screen.queryByRole('button', { name: /^Remove/ });
		const line = () =>
			document.querySelector('.nimble-result-line__text')?.textContent?.replace(/\s+/g, ' ').trim();

		it.each([
			[{ change: 'succeed', value: 0, stat: '' }, 'Succeed Instead with Soothsayer'],
			[{ change: 'setTotal', value: 10, stat: '' }, 'Change to 10 with Soothsayer'],
			[{ change: 'add', value: 3, stat: 'strength' }, 'Add +3 STR with Soothsayer'],
			[{ change: 'add', value: -1, stat: 'strength' }, 'Add \u22121 STR with Soothsayer'],
		])('words the row of %o', async (use, words) => {
			const { entry } = resultEntry(use);
			const message = createMessage({
				incomingReactions: [{ ...entry, ruleId: 'rule-seer', itemUuid: 'Item.seer' }],
			});
			Object.assign(message, { id: `row-${words}`, resultUseOf: vi.fn(() => use) });
			renderSave(message);
			await openControl();

			expect(rowWords(rowsOf()[0])).toContain(words);
		});

		it('shows the total with the changes on it, and the roll stays', () => {
			const message = createMessage({
				incomingReactions: [],
				resultChanges: [resultChange(), resultChange({ id: 'click-2' })],
			});
			renderSave(message);

			expect(shownTotal()).toBe('12');
			expect(sumBox()).toBe('6 + 3 + 3 = 12');
			expect(line()).toBe('Added +6 STR, Gained 2 Wounds with Mighty Soul');
			expect(message.rolls[0].total).toBe(6);
		});

		it('says "changed to" for a set total', () => {
			renderSave(
				createMessage({
					incomingReactions: [],
					resultChanges: [resultChange({ change: 'setTotal', value: 13, stat: '' })],
				}),
			);

			// The history line tells both numbers, so one set total has no sum box.
			expect(shownTotal()).toBe('13');
			expect(sumBox()).toBeUndefined();
			expect(line()).toBe('Changed 6 to 13 with Mighty Soul');
		});

		it('tells a natural 20 made by itself, with no Remove, and the roll stays', () => {
			const message = createMessage({
				incomingReactions: [],
				resultChanges: [
					resultChange({
						change: 'countsAsNat20',
						value: 19,
						stat: '',
						automatic: true,
						paid: { charges: 0, mana: 0, wounds: 0 },
					}),
				],
			});
			message.rolls[0].total = 1;
			renderSave(message);

			expect(shownTotal()).toBe('19');
			expect(sumBox()).toBe('Rolled 1, counts as 20 \u2212 1 = 19');
			expect(line()).toBe('Counts as a Natural 20 with Mighty Soul');
			expect(removeButton()).toBeNull();
			expect(message.rolls[0].total).toBe(1);
		});

		it('shows no sum box when the total is the roll, as after a succeed', () => {
			const message = createMessage({
				dc: 14,
				incomingReactions: [],
				resultChanges: [resultChange({ change: 'succeed', value: 0, stat: '' })],
			});
			Object.assign(message, { type: 'savingThrow' });
			renderSave(message);

			expect(sumBox()).toBeUndefined();
			expect(shownTotal()).toBe('6');
			expect(line()).toBe('Succeeded Instead with Mighty Soul');
			expect(document.querySelector('.roll__result--succeeded')?.textContent).toContain(
				'Succeeded - DC 14',
			);
		});

		it('keeps a Succeeded card closed, with the other rows under the button', () => {
			const message = createMessage({
				dc: 14,
				incomingReactions: [rerollEntry()],
				resultChanges: [resultChange({ change: 'succeed', value: 0, stat: '' })],
			});
			Object.assign(message, { id: 'closed-on-succeeded', type: 'savingThrow' });
			renderSave(message);

			expect(controlButton()?.getAttribute('aria-expanded')).toBe('false');
			expect(controlButton()?.textContent).toContain('(1)');
		});

		it('sends a Remove click for the line', async () => {
			requestResultRemoval.mockResolvedValue(undefined);
			const message = createMessage({ incomingReactions: [], resultChanges: [resultChange()] });
			renderSave(message);

			await fireEvent.click(removeButton() as HTMLElement);

			expect(requestResultRemoval).toHaveBeenCalledWith('message-1', 'click-1');
			expect(removeButton()?.hasAttribute('disabled')).toBe(true);
		});

		it('gives the GM Remove on a line of another owner', () => {
			rollerIsOwner = false;
			globals.game.user = { isGM: true, id: 'gm' };
			renderSave(createMessage({ incomingReactions: [], resultChanges: [resultChange()] }));

			expect(removeButton()).not.toBeNull();
		});

		it('shows the line with no Remove to a player who cannot click the row', () => {
			rollerIsOwner = false;
			renderSave(createMessage({ incomingReactions: [], resultChanges: [resultChange()] }));

			expect(line()).toContain('Added +3 STR');
			expect(removeButton()).toBeNull();
		});

		it('shows a retired line with no Remove and starts the sum from the new roll', () => {
			renderSave(
				createMessage({
					incomingReactions: [],
					resultChanges: [resultChange({ retired: true, before: 2 })],
				}),
			);

			expect(line()).toContain('Added +3 STR');
			expect(removeButton()).toBeNull();
			expect(sumBox()).toBeUndefined();
			expect(shownTotal()).toBe('6');
		});

		it('has no Remove while a reroll waits for a keep', () => {
			renderSave(
				createMessage({
					incomingReactions: [],
					resultChanges: [resultChange()],
					pendingKeep: {
						entryId: 'entry-brutality',
						chooserUuid: ROLLER,
						reroll: rerollRecord(),
						old: { total: 9, outcome: null },
						new: { total: 14, outcome: null },
					},
				}),
			);

			expect(removeButton()).toBeNull();
		});
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
		expect(controlButton()).toBeNull();
		expect(document.querySelector('.nimble-roll-changes')).toBeNull();
	});
});
