/**
 * Live regression tests for swapping class options on a rest, driven through the real
 * Safe Rest and Field Rest dialogs: the sheet's rest button is clicked, the "Change my
 * options" row is expanded, picks are given up and chosen through the option cards, and
 * the dialog's own rest button confirms. The unit suite pins the planner and the summary
 * against fixtures; what needs a live world is the whole path from a click to the
 * embedded items, the level-up history, the charge pool, and the chat card.
 *
 * A pool is a row of places, one chip per pick. Giving a pick up empties its place and
 * sends the pick back to the choices below; choosing a member fills the first empty place.
 *
 * Most characters are built the way the level-up path leaves them: a class item at the
 * target level, one history entry per level, and the picks recorded against the entries
 * that granted them. A pick is an item on the sheet. The history only decides which copy
 * of a member leaves first, so a hand-added item is a pick like any other, and a character
 * with no history still sees every pool their levels grant.
 */

import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { messageFromFlow, purgeTestDocuments, settle, waitFor } from './liveHelpers.ts';

const TEST_PREFIX = 'V14 Option Swap';

const SWAP_FOOTER_LABEL = 'Safe Rest and swap options';

interface SwapItem {
	id: string;
	name: string;
	_stats?: { compendiumSource?: string | null };
	system: { rules?: Array<Record<string, unknown>> };
	flags: Record<string, Record<string, unknown> | undefined>;
}

interface HistoryEntry {
	level: number;
	grantedFeatureIds: string[];
}

interface SwapActor {
	id: string;
	name: string;
	classes: Record<string, { id: string; identifier: string }>;
	items: { contents: SwapItem[]; get(id: string): SwapItem | undefined };
	system: {
		classData: { levels: string[] };
		levelUpHistory: HistoryEntry[];
		skills: Record<string, { points: number; mod: number }>;
	};
	levels: { character: number };
	sheet: {
		render(force: boolean): Promise<unknown>;
		close(): Promise<unknown>;
		element: HTMLElement;
	};
	update(changes: Record<string, unknown>): Promise<unknown>;
	updateItem(itemId: string, changes: Record<string, unknown>): Promise<unknown>;
	revertLastLevelUp(): Promise<unknown>;
	rules: Iterable<{ type: string; poolIdentifier?: string; appliesToPool?(id: string): boolean }>;
}

interface RestMessage {
	id: string;
	system: { optionChanges?: Array<{ label: string; removed: string[]; added: string[] }> };
}

/**
 * Embeds a pack document with its source recorded, the way a grant or a drag from the
 * compendium does. The swap attributes a pick to a pool by that source; whether the item is
 * a pick at all is decided by the history entry `levelTo` records it under.
 */
async function embedFromPack(
	actor: SwapActor,
	packName: string,
	name: string,
	overrides: Record<string, unknown> = {},
): Promise<SwapItem> {
	const pack = game.packs.get(`${game.system.id}.${packName}`)!;
	const index = await pack.getIndex();
	const entry = index.contents.find((candidate) => candidate.name === name);
	if (!entry) throw new Error(`${packName} has no "${name}"`);
	const doc = (await pack.getDocument(entry._id as string))!;
	const source = foundry.utils.mergeObject(
		doc.toObject() as Record<string, unknown>,
		overrides,
	) as Record<string, unknown>;
	foundry.utils.setProperty(source, '_stats.compendiumSource', doc.uuid);
	const [item] = await (actor as unknown as Actor).createEmbeddedDocuments('Item', [
		source as unknown as Item.CreateData,
	]);
	return item as unknown as SwapItem;
}

/** A level-up history entry as the level-up dialog writes it. */
function historyEntry(level: number, classIdentifier: string, grantedFeatureIds: string[] = []) {
	return {
		level,
		hpIncrease: 0,
		abilityIncreases: {},
		skillIncreases: {},
		hitDieAdded: false,
		classIdentifier,
		grantedFeatureIds,
		grantedSpellIds: [],
	};
}

/** Raises the character to `level`, with `granted` mapping a level to the item ids it granted. */
async function levelTo(actor: SwapActor, level: number, granted: Record<number, string[]> = {}) {
	const characterClass = Object.values(actor.classes)[0]!;
	await actor.updateItem(characterClass.id, { 'system.classLevel': level });
	await actor.update({
		'system.classData.levels': Array.from({ length: level }, () => characterClass.identifier),
		'system.levelUpHistory': Array.from({ length: level - 1 }, (_, index) =>
			historyEntry(index + 2, characterClass.identifier, granted[index + 2] ?? []),
		),
	});
	await settle();
}

const restDialog = (kind: 'safe' | 'field') =>
	document.querySelector<HTMLElement>(`.application:has(.${kind}-rest-dialog)`);

interface RestApp {
	position: { top: number; height: number | string };
	setPosition(position: { top: number }): unknown;
}

/** The application behind an open rest dialog, for reading and setting its position. */
function restApp(kind: 'safe' | 'field'): RestApp {
	for (const app of foundry.applications.instances.values()) {
		const element = (app as { element?: HTMLElement }).element;
		if (element?.querySelector(`.${kind}-rest-dialog`)) return app as unknown as RestApp;
	}
	throw new Error(`no ${kind} rest application is open`);
}

/**
 * Pushes the window to the bottom of the viewport, so any growth in its content can only be
 * absorbed by the host refitting it. Returns the top it was pushed to.
 */
async function pinToViewportBottom(dialog: HTMLElement, app: RestApp): Promise<number> {
	const height = dialog.getBoundingClientRect().height;
	await app.setPosition({ top: document.documentElement.clientHeight - height });
	await settle(200);
	return app.position.top;
}

const bottomOf = (dialog: HTMLElement) => dialog.getBoundingClientRect().bottom;

/** A dialog a failed test left open would be found in place of the one under test. */
async function closeStaleRestDialogs() {
	for (const app of foundry.applications.instances.values()) {
		const element = (app as { element?: HTMLElement }).element;
		if (element?.querySelector('.safe-rest-dialog, .field-rest-dialog')) {
			await (app as { close(): Promise<unknown> }).close().catch(() => {});
		}
	}
	await waitFor(
		() => restDialog('safe') === null && restDialog('field') === null,
		'stale rest dialogs to close',
	);
}

async function openRestDialog(actor: SwapActor, kind: 'safe' | 'field'): Promise<HTMLElement> {
	await closeStaleRestDialogs();
	await actor.sheet.render(true);
	await settle(800);
	const label = kind === 'safe' ? 'Safe Rest' : 'Field Rest';
	const button = actor.sheet.element.querySelector<HTMLButtonElement>(
		`button[aria-label="${label}"]`,
	);
	if (!button) throw new Error(`the sheet has no ${label} button`);
	button.click();
	await waitFor(() => restDialog(kind) !== null, `the ${label} dialog to open`);
	await settle(500);
	return restDialog(kind)!;
}

async function expandOptions(dialog: HTMLElement) {
	await waitFor(
		() => dialog.querySelector('.nimble-option-swap__toggle') !== null,
		'the Change my options row',
	);
	dialog.querySelector<HTMLButtonElement>('.nimble-option-swap__toggle')!.click();
	await waitFor(
		() => dialog.querySelector('.nimble-option-swap__body') !== null,
		'the section to open',
	);
}

/** The card of the feature that makes the offer, headed by its name. */
function cardNamed(dialog: HTMLElement, name: string): HTMLElement {
	const cards = [...dialog.querySelectorAll<HTMLElement>('.nimble-option-swap__card')];
	const card = cards.find(
		(candidate) =>
			candidate.querySelector('.nimble-option-swap__card-title strong')?.textContent?.trim() ===
			name,
	);
	if (!card) {
		const names = cards.map((candidate) =>
			candidate.querySelector('.nimble-option-swap__card-title strong')?.textContent?.trim(),
		);
		throw new Error(`no card headed "${name}"; cards: ${names.join(' | ')}`);
	}
	return card;
}

function poolSection(dialog: HTMLElement, headingPart: string): HTMLElement {
	const pools = [...dialog.querySelectorAll<HTMLElement>('.nimble-option-swap__pool')];
	const pool = pools.find((candidate) =>
		candidate.querySelector('.nimble-heading')?.textContent?.includes(headingPart),
	);
	if (!pool) {
		const headings = pools.map(
			(candidate) => candidate.querySelector('.nimble-heading')?.textContent,
		);
		throw new Error(`no pool headed "${headingPart}"; pools: ${headings.join(' | ')}`);
	}
	return pool;
}

/**
 * The chips the places stand in. A pool drawing on more than one option list holds one chip
 * list per list, so the places are every chip above the fold button and the choices are the
 * rest.
 */
function placesOf(pool: HTMLElement): HTMLElement[] {
	const fold = pool.querySelector('.nimble-option-swap__unfold');
	const chipLists = [...pool.querySelectorAll<HTMLElement>('.nimble-option-swap__chips')].filter(
		(list) =>
			!fold || Boolean(fold.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_PRECEDING),
	);
	return chipLists.flatMap((list) => [
		...list.querySelectorAll<HTMLElement>('.nimble-option-swap__chip'),
	]);
}

/** What stands in each place, in order, with `null` for an empty one. */
const placeNames = (pool: HTMLElement): Array<string | null> =>
	placesOf(pool).map(
		(chip) => chip.querySelector('.nimble-option-swap__chip-name')?.textContent?.trim() ?? null,
	);

/** The sub-heading of each option list, in the order they are shown. */
const listTitles = (pool: HTMLElement) =>
	[...pool.querySelectorAll('.nimble-option-swap__list-title')].map((title) =>
		title.textContent?.trim(),
	);

const emptyPlaces = (pool: HTMLElement) =>
	placesOf(pool).filter((chip) => chip.classList.contains('nimble-option-swap__chip--empty'))
		.length;

const countText = (pool: HTMLElement) =>
	pool.querySelector('.nimble-option-swap__count')?.textContent?.trim();

/** The chip a pick stands in, which is what the pointer rests on to open the hover card. */
function chipNamed(pool: HTMLElement, name: string): HTMLElement {
	const chip = placesOf(pool).find(
		(candidate) =>
			candidate.querySelector('.nimble-option-swap__chip-name')?.textContent?.trim() === name,
	);
	if (!chip) throw new Error(`no chip named "${name}"; places: ${placeNames(pool).join(' | ')}`);
	return chip;
}

const peekCard = () => document.querySelector<HTMLElement>('.nimble-option-peek');

async function clickControl(root: HTMLElement, ariaLabel: string) {
	await waitFor(() => root.querySelector(`[aria-label="${ariaLabel}"]`) !== null, `"${ariaLabel}"`);
	root.querySelector<HTMLButtonElement>(`[aria-label="${ariaLabel}"]`)!.click();
	await settle(200);
}

const isUnfolded = (pool: HTMLElement) =>
	pool.querySelector('.nimble-option-swap__unfold')?.getAttribute('aria-expanded') === 'true';

async function unfold(pool: HTMLElement) {
	if (isUnfolded(pool)) return;
	pool.querySelector<HTMLButtonElement>('.nimble-option-swap__unfold')!.click();
	await settle(200);
}

/** Empties the place a pick stands in. The pick goes back among the choices. */
const giveUp = (pool: HTMLElement, name: string) => clickControl(pool, `Give up ${name}`);

/** Fills the first empty place from the choices, which are unfolded first if they are shut. */
async function choose(pool: HTMLElement, name: string) {
	await unfold(pool);
	await clickControl(pool, `Select ${name}`);
}

const choiceControl = (pool: HTMLElement, name: string) =>
	pool.querySelector<HTMLButtonElement>(`[aria-label="Select ${name}"]`);

/** Every hint under a pool: the slot warnings and the status line. */
const hintText = (pool: HTMLElement) =>
	[...pool.querySelectorAll('.nimble-hint')].map((hint) => hint.textContent?.trim()).join(' | ');

const footerLabel = (dialog: HTMLElement) =>
	dialog.querySelector('.nimble-sheet__footer button')?.textContent?.trim();

function chooseSkill(select: HTMLSelectElement, key: string) {
	select.value = key;
	select.dispatchEvent(new Event('change', { bubbles: true }));
}

const skillSelect = (root: HTMLElement, label: 'from a skill' | 'to a skill') =>
	root.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`);

async function confirmRest(actor: SwapActor, dialog: HTMLElement, type: 'safeRest' | 'fieldRest') {
	const message = await messageFromFlow(type, async () => {
		dialog.querySelector<HTMLButtonElement>('.nimble-sheet__footer button')!.click();
		await waitFor(
			() => restDialog(type === 'safeRest' ? 'safe' : 'field') === null,
			'the dialog to close',
		);
		await settle(800);
	});
	await settle(500);
	await actor.sheet.close().catch(() => {});
	return message as unknown as RestMessage | undefined;
}

const ownedNamed = (actor: SwapActor, name: string) =>
	actor.items.contents.filter((item) => item.name === name);

const historyIds = (actor: SwapActor) =>
	actor.system.levelUpHistory.flatMap((entry) => entry.grantedFeatureIds);

beforeAll(async () => {
	await purgeTestDocuments(TEST_PREFIX);
});

afterAll(async () => {
	await purgeTestDocuments(TEST_PREFIX);
});

// The pool's maximum is derived from the poolMaxBonus rules the character holds, one per
// die item, so the rules are the observable the swap has to move.
function dieBonusOf(actor: SwapActor): number {
	const rules = actor.rules instanceof Map ? [...actor.rules.values()] : [...actor.rules];
	return rules.filter(
		(rule) =>
			rule.type === 'poolMaxBonus' &&
			rule.appliesToPool?.('combat-dice') !== false &&
			rule.poolIdentifier === 'combat-dice',
	).length;
}

describe('a Commander with two max Combat Die picks', () => {
	let commander: SwapActor;
	let dieItems: SwapItem[];
	let handAdded: SwapItem;

	beforeAll(async () => {
		commander = (await Actor.create({
			name: `${TEST_PREFIX} Commander`,
			type: 'character',
			system: { abilities: { strength: { baseValue: 3 } } },
		} as Actor.CreateData)) as unknown as SwapActor;

		await embedFromPack(commander, 'nimble-classes', 'Commander');
		await settle();

		// Level 2 orders, level 4 pool feature and first tactic, level 6 and 8 max die picks,
		// level 10 a second tactic, then the feature that offers the swap.
		const orders = await Promise.all(
			['Face Me!', 'Hold the Line!'].map((name) =>
				embedFromPack(commander, 'nimble-class-features', name),
			),
		);
		const poolItem = await embedFromPack(
			commander,
			'nimble-class-features',
			'Fit for Any Battlefield',
		);
		const tacticItem = await embedFromPack(commander, 'nimble-class-features', 'Heavy Strike');
		const secondTactic = await embedFromPack(commander, 'nimble-class-features', 'Lunging Strike');
		dieItems = [
			await embedFromPack(commander, 'nimble-class-features', '+1 Max Combat Die'),
			await embedFromPack(commander, 'nimble-class-features', '+1 Max Combat Die'),
		];
		const training = await embedFromPack(commander, 'nimble-class-features', 'Rigorous Training');

		await levelTo(commander, 10, {
			2: orders.map((item) => item.id),
			4: [poolItem.id, tacticItem.id, training.id],
			6: [dieItems[0]!.id],
			8: [dieItems[1]!.id],
			10: [secondTactic.id],
		});
	}, 120_000);

	afterAll(async () => {
		await commander.sheet.close().catch(() => {});
	});

	test('the dialog offers one merged pool with the die standing in two places', async () => {
		const dialog = await openRestDialog(commander, 'safe');
		await expandOptions(dialog);

		const pool = poolSection(dialog, 'Fit for Any Battlefield');
		// Six picks, six chips. The die is held twice, so it stands in two places of its own.
		expect(placeNames(pool).sort()).toEqual([
			'+1 Max Combat Die',
			'+1 Max Combat Die',
			'Face Me!',
			'Heavy Strike',
			'Hold the Line!',
			'Lunging Strike',
		]);
		expect(pool.querySelectorAll('[aria-label="Give up +1 Max Combat Die"]')).toHaveLength(2);
		expect(emptyPlaces(pool)).toBe(0);
		expect(countText(pool)).toBe('6 / 6');
		// The sheet holds what the levels grant, so nothing is said about the holdings.
		expect(pool.textContent).not.toContain('Your level gives you');

		// Every place is full, so the choices are shown but cannot be taken.
		await unfold(pool);
		expect(pool.textContent).toContain('Give up an option to choose another.');
		expect(choiceControl(pool, 'Sweeping Strike')?.hasAttribute('disabled')).toBe(true);

		// The pool sits in the card of the feature that offers the swap.
		expect(cardNamed(dialog, 'Rigorous Training').contains(pool)).toBe(true);

		// The die must not also be offered under its own heading.
		const headings = [...dialog.querySelectorAll('.nimble-option-swap__pool .nimble-heading')].map(
			(heading) => heading.textContent?.trim(),
		);
		expect(headings.filter((heading) => heading?.includes('Fit for Any Battlefield'))).toHaveLength(
			1,
		);

		await closeWithoutResting(dialog);
	}, 60_000);

	test('the pool heads its chips with one title per option list', async () => {
		const dialog = await openRestDialog(commander, 'safe');
		await expandOptions(dialog);

		const pool = poolSection(dialog, 'Fit for Any Battlefield');

		// The two lists the pool draws on, then the option the levels grant outright.
		expect(listTitles(pool)).toEqual(['Commanders Orders', 'Combat Tactics', '+1 Max Combat Die']);

		// Both copies of the die stand under its own title.
		const dieList = [...pool.querySelectorAll('.nimble-option-swap__list')].find(
			(list) =>
				list.querySelector('.nimble-option-swap__list-title')?.textContent?.trim() ===
				'+1 Max Combat Die',
		)!;
		expect(dieList.querySelectorAll('[aria-label="Give up +1 Max Combat Die"]')).toHaveLength(2);

		// The choices below the fold are split the same way, in the same order.
		await unfold(pool);
		expect(listTitles(pool)).toEqual([
			'Commanders Orders',
			'Combat Tactics',
			'+1 Max Combat Die',
			'Commanders Orders',
			'Combat Tactics',
			'+1 Max Combat Die',
		]);

		await closeWithoutResting(dialog);
	}, 60_000);

	test('resting the pointer on a chip opens a card on the body, and leaving closes it', async () => {
		const dialog = await openRestDialog(commander, 'safe');
		await expandOptions(dialog);

		const pool = poolSection(dialog, 'Fit for Any Battlefield');
		const chip = chipNamed(pool, 'Heavy Strike');

		chip.dispatchEvent(new MouseEvent('mouseenter'));
		await waitFor(() => peekCard() !== null, 'the hover card to open');

		// The card is on the body, so the dialog it belongs to cannot clip it, and it stacks
		// above every window, so the dialog cannot cover it either.
		expect(peekCard()!.parentElement).toBe(document.body);
		expect(peekCard()!.textContent).toContain('Heavy Strike');
		const windowElement = dialog.closest<HTMLElement>('.application')!;
		expect(Number(getComputedStyle(peekCard()!).zIndex)).toBeGreaterThan(
			Number(getComputedStyle(windowElement).zIndex),
		);

		chip.dispatchEvent(new MouseEvent('mouseleave'));
		await waitFor(() => peekCard() === null, 'the hover card to close');

		await closeWithoutResting(dialog);
	}, 60_000);

	test('a plain safe rest changes no options and posts no change', async () => {
		const dialog = await openRestDialog(commander, 'safe');
		const message = await confirmRest(commander, dialog, 'safeRest');

		expect(message?.system.optionChanges ?? []).toEqual([]);
		expect(ownedNamed(commander, '+1 Max Combat Die')).toHaveLength(2);
		expect(dieBonusOf(commander)).toBe(2);
	}, 60_000);

	test('trading one die for a Combat Ability leaves the other and drops the pool bonus by one', async () => {
		const historyBefore = historyIds(commander);

		const dialog = await openRestDialog(commander, 'safe');
		await expandOptions(dialog);
		const pool = poolSection(dialog, 'Fit for Any Battlefield');

		await unfold(pool);
		// Every place is full, so the choices stay greyed until a pick is given up.
		expect(choiceControl(pool, 'Sweeping Strike')?.hasAttribute('disabled')).toBe(true);
		expect(footerLabel(dialog)).not.toBe(SWAP_FOOTER_LABEL);

		await giveUp(pool, '+1 Max Combat Die');
		// One copy is still held, so one chip stays and the other place is empty.
		expect(pool.querySelectorAll('[aria-label="Give up +1 Max Combat Die"]')).toHaveLength(1);
		expect(emptyPlaces(pool)).toBe(1);
		expect(countText(pool)).toBe('5 / 6');
		expect(hintText(pool)).toContain('Choose 1 more option to complete the swap.');

		await choose(pool, 'Sweeping Strike');
		expect(countText(pool)).toBe('6 / 6');
		expect(hintText(pool)).toContain('You give up +1 Max Combat Die and take Sweeping Strike.');
		// The button names the swap while one is ready to confirm.
		expect(footerLabel(dialog)).toBe(SWAP_FOOTER_LABEL);

		const message = await confirmRest(commander, dialog, 'safeRest');

		await waitFor(
			() => ownedNamed(commander, 'Sweeping Strike').length === 1,
			'the tactic to be granted',
		);
		expect(ownedNamed(commander, '+1 Max Combat Die')).toHaveLength(1);

		// One die item fewer is one poolMaxBonus rule fewer, which is what the pool's maximum reads.
		await waitFor(() => dieBonusOf(commander) === 1, 'the pool bonus to drop by one');

		// The oldest pick is the one released, so the level 6 die went and the level 8 die stays.
		expect(commander.items.get(dieItems[0]!.id)).toBeUndefined();
		expect(commander.items.get(dieItems[1]!.id)).toBeDefined();

		// The replacement took over the history entry of the die it replaced.
		const granted = ownedNamed(commander, 'Sweeping Strike')[0]!;
		const historyAfter = historyIds(commander);
		expect(historyAfter).not.toContain(dieItems[0]!.id);
		expect(historyAfter).toContain(granted.id);
		expect(historyAfter).toHaveLength(historyBefore.length);
		expect(
			commander.system.levelUpHistory.find((entry) => entry.grantedFeatureIds.includes(granted.id))
				?.level,
		).toBe(6);

		expect(message?.system.optionChanges).toEqual([
			expect.objectContaining({ removed: ['+1 Max Combat Die'], added: ['Sweeping Strike'] }),
		]);
		const card = document.querySelector(`#chat [data-message-id="${message!.id}"]`);
		expect(card?.querySelector('.option-changes__removed')?.textContent).toBe('+1 Max Combat Die');
		expect(card?.querySelector('.option-changes__added')?.textContent).toBe('Sweeping Strike');
	}, 90_000);

	test('a Commander holding one die takes a second in place of an ability', async () => {
		const dialog = await openRestDialog(commander, 'safe');
		await expandOptions(dialog);
		const pool = poolSection(dialog, 'Fit for Any Battlefield');

		// The die may be taken again, so it is offered even while it is held, but no place is free.
		await unfold(pool);
		expect(choiceControl(pool, '+1 Max Combat Die')?.hasAttribute('disabled')).toBe(true);

		await giveUp(pool, 'Heavy Strike');
		expect(choiceControl(pool, '+1 Max Combat Die')?.hasAttribute('disabled')).toBe(false);

		await choose(pool, '+1 Max Combat Die');
		expect(pool.querySelectorAll('[aria-label="Give up +1 Max Combat Die"]')).toHaveLength(2);
		expect(countText(pool)).toBe('6 / 6');

		const message = await confirmRest(commander, dialog, 'safeRest');

		await waitFor(
			() => ownedNamed(commander, '+1 Max Combat Die').length === 2,
			'the second die to be granted',
		);
		expect(ownedNamed(commander, 'Heavy Strike')).toHaveLength(0);
		await waitFor(() => dieBonusOf(commander) === 2, 'the pool bonus to rise by one');

		// The new die took over the level 4 entry that Heavy Strike vacated.
		const newDie = ownedNamed(commander, '+1 Max Combat Die').find(
			(item) => item.id !== dieItems[1]!.id,
		)!;
		expect(
			commander.system.levelUpHistory.find((entry) => entry.grantedFeatureIds.includes(newDie.id))
				?.level,
		).toBe(4);
		expect(message?.system.optionChanges).toEqual([
			expect.objectContaining({ removed: ['Heavy Strike'], added: ['+1 Max Combat Die'] }),
		]);
	}, 90_000);

	test('a duplicate dragged on by hand is a pick: counted, not offered, and shown as one over the grant', async () => {
		// No history entry records this second copy. The sheet holds it, so it is a pick like any other.
		handAdded = await embedFromPack(commander, 'nimble-class-features', 'Face Me!');
		await settle();

		const dialog = await openRestDialog(commander, 'safe');
		await expandOptions(dialog);
		const pool = poolSection(dialog, 'Fit for Any Battlefield');

		// Seven picks in seven places, one more than the levels grant.
		expect(placeNames(pool)).toHaveLength(7);
		expect(emptyPlaces(pool)).toBe(0);
		expect(countText(pool)).toBe('7 / 6');
		expect(pool.querySelector('.nimble-option-swap__count')?.className).toContain('count--over');
		expect(pool.textContent).toContain('Your level gives you 6 options. You have 7.');
		// Two copies stand in two places. An Order may not be taken twice, so it is not offered.
		expect(pool.querySelectorAll('[aria-label="Give up Face Me!"]')).toHaveLength(2);
		await unfold(pool);
		expect(choiceControl(pool, 'Face Me!')).toBeNull();

		// A trade at seven still works: one die for an ability, the hand-added item untouched.
		await giveUp(pool, '+1 Max Combat Die');
		await choose(pool, 'Heavy Strike');
		const message = await confirmRest(commander, dialog, 'safeRest');

		await waitFor(
			() => ownedNamed(commander, 'Heavy Strike').length === 1,
			'the ability to be granted',
		);
		expect(commander.items.get(handAdded.id)).toBeDefined();
		expect(historyIds(commander)).not.toContain(handAdded.id);
		expect(ownedNamed(commander, '+1 Max Combat Die')).toHaveLength(1);
		expect(message?.system.optionChanges).toEqual([
			expect.objectContaining({ removed: ['+1 Max Combat Die'], added: ['Heavy Strike'] }),
		]);
	}, 120_000);

	test('levelling down removes what each level records and leaves the hand-added item alone', async () => {
		// After the swaps the one die left is the level 8 pick. Level 10 holds Lunging Strike.
		expect(ownedNamed(commander, '+1 Max Combat Die')).toHaveLength(1);

		while (commander.levels.character > 8) {
			await commander.revertLastLevelUp();
			await settle(300);
		}
		expect(ownedNamed(commander, 'Lunging Strike')).toHaveLength(0);
		expect(ownedNamed(commander, '+1 Max Combat Die')).toHaveLength(1);
		expect(dieBonusOf(commander)).toBe(1);

		await commander.revertLastLevelUp();
		await settle(300);
		expect(commander.levels.character).toBe(7);
		expect(ownedNamed(commander, '+1 Max Combat Die')).toHaveLength(0);
		expect(dieBonusOf(commander)).toBe(0);

		// The hand-added copy is in no entry, so no level down can reach it.
		expect(ownedNamed(commander, 'Face Me!')).toHaveLength(2);
		expect(commander.items.get(handAdded.id)).toBeDefined();
	}, 90_000);

	test('a Commander holding no die takes one in place of an ability', async () => {
		expect(ownedNamed(commander, '+1 Max Combat Die')).toHaveLength(0);

		const dialog = await openRestDialog(commander, 'safe');
		await expandOptions(dialog);
		const pool = poolSection(dialog, 'Fit for Any Battlefield');
		await unfold(pool);

		// With no pick of it, the die sits among the choices like any other member.
		expect(choiceControl(pool, '+1 Max Combat Die')).not.toBeNull();
		await giveUp(pool, 'Sweeping Strike');
		await choose(pool, '+1 Max Combat Die');
		const message = await confirmRest(commander, dialog, 'safeRest');

		await waitFor(
			() => ownedNamed(commander, '+1 Max Combat Die').length === 1,
			'the die to be granted',
		);
		expect(ownedNamed(commander, 'Sweeping Strike')).toHaveLength(0);
		await waitFor(() => dieBonusOf(commander) === 1, 'the pool bonus to rise by one');
		const die = ownedNamed(commander, '+1 Max Combat Die')[0]!;
		expect(
			commander.system.levelUpHistory.find((entry) => entry.grantedFeatureIds.includes(die.id))
				?.level,
		).toBe(6);
		expect(message?.system.optionChanges).toEqual([
			expect.objectContaining({ removed: ['Sweeping Strike'], added: ['+1 Max Combat Die'] }),
		]);
	}, 90_000);

	test('a field rest offers no swap when the feature only names the safe rest', async () => {
		const dialog = await openRestDialog(commander, 'field');
		await settle(800);

		expect(dialog.querySelector('.nimble-option-swap')).toBeNull();
		await closeWithoutResting(dialog);
	}, 60_000);
});

describe('a Commander with three max Combat Die picks and nothing else in the pool', () => {
	let commander: SwapActor;
	let dieItems: SwapItem[];

	beforeAll(async () => {
		commander = (await Actor.create({
			name: `${TEST_PREFIX} Commander of Dice`,
			type: 'character',
			system: { abilities: { strength: { baseValue: 3 } } },
		} as Actor.CreateData)) as unknown as SwapActor;

		await embedFromPack(commander, 'nimble-classes', 'Commander');
		await settle();

		// Level 4 the pool feature and the swap feature, then the die at every level it is offered
		// up to 10, so every pick in the pool is a die.
		const poolItem = await embedFromPack(
			commander,
			'nimble-class-features',
			'Fit for Any Battlefield',
		);
		const training = await embedFromPack(commander, 'nimble-class-features', 'Rigorous Training');
		dieItems = [
			await embedFromPack(commander, 'nimble-class-features', '+1 Max Combat Die'),
			await embedFromPack(commander, 'nimble-class-features', '+1 Max Combat Die'),
			await embedFromPack(commander, 'nimble-class-features', '+1 Max Combat Die'),
		];

		await levelTo(commander, 10, {
			4: [poolItem.id, training.id],
			6: [dieItems[0]!.id],
			8: [dieItems[1]!.id],
			10: [dieItems[2]!.id],
		});
	}, 120_000);

	afterAll(async () => {
		await commander.sheet.close().catch(() => {});
	});

	test('giving up every die and taking three abilities removes every die item and its bonus', async () => {
		expect(ownedNamed(commander, '+1 Max Combat Die')).toHaveLength(3);
		expect(dieBonusOf(commander)).toBe(3);

		const dialog = await openRestDialog(commander, 'safe');
		await expandOptions(dialog);
		const pool = poolSection(dialog, 'Fit for Any Battlefield');

		// The levels grant six picks and the sheet holds three, so three places stand empty.
		expect(pool.querySelectorAll('[aria-label="Give up +1 Max Combat Die"]')).toHaveLength(3);
		expect(placeNames(pool)).toHaveLength(6);
		expect(emptyPlaces(pool)).toBe(3);
		expect(countText(pool)).toBe('3 / 6');
		expect(pool.textContent).toContain(
			'Your level gives you 6 options. You have 3. Choose 3 more.',
		);

		// Three give-ups empty every place the dice stood in.
		await giveUp(pool, '+1 Max Combat Die');
		await giveUp(pool, '+1 Max Combat Die');
		await giveUp(pool, '+1 Max Combat Die');
		expect(pool.querySelector('[aria-label="Give up +1 Max Combat Die"]')).toBeNull();
		expect(emptyPlaces(pool)).toBe(6);
		expect(countText(pool)).toBe('0 / 6');
		expect(hintText(pool)).toContain('Choose 3 more options to complete the swap.');
		// The released die sits among the choices, like any member with no pick.
		expect(choiceControl(pool, '+1 Max Combat Die')).not.toBeNull();

		// No ability can be taken twice, so three dice become three different abilities.
		await choose(pool, 'Heavy Strike');
		await choose(pool, 'Sweeping Strike');
		await choose(pool, 'Lunging Strike');
		expect(countText(pool)).toBe('3 / 6');
		expect(hintText(pool)).toContain('You give up +1 Max Combat Die x3 and take');

		const message = await confirmRest(commander, dialog, 'safeRest');

		await waitFor(
			() => ownedNamed(commander, '+1 Max Combat Die').length === 0,
			'every die to be removed',
		);
		for (const die of dieItems) expect(commander.items.get(die.id)).toBeUndefined();
		await waitFor(() => dieBonusOf(commander) === 0, 'the pool bonus to drop to nothing');
		expect(ownedNamed(commander, 'Heavy Strike')).toHaveLength(1);
		expect(ownedNamed(commander, 'Sweeping Strike')).toHaveLength(1);
		expect(ownedNamed(commander, 'Lunging Strike')).toHaveLength(1);

		// Each ability took over the entry of one die, so the three levels still record one pick each.
		const grantedIds = ['Heavy Strike', 'Sweeping Strike', 'Lunging Strike'].map(
			(name) => ownedNamed(commander, name)[0]!.id,
		);
		const levelsHolding = grantedIds.map(
			(id) =>
				commander.system.levelUpHistory.find((entry) => entry.grantedFeatureIds.includes(id))
					?.level,
		);
		expect([...levelsHolding].sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([6, 8, 10]);
		for (const die of dieItems) expect(historyIds(commander)).not.toContain(die.id);

		expect(message?.system.optionChanges).toEqual([
			expect.objectContaining({
				removed: ['+1 Max Combat Die x3'],
				added: expect.arrayContaining(['Heavy Strike', 'Sweeping Strike', 'Lunging Strike']),
			}),
		]);
		expect(message?.system.optionChanges?.[0]?.added).toHaveLength(3);
	}, 120_000);
});

describe('a Commander built by hand with no level-up history', () => {
	let commander: SwapActor;

	beforeAll(async () => {
		commander = (await Actor.create({
			name: `${TEST_PREFIX} Hand-built Commander`,
			type: 'character',
		} as Actor.CreateData)) as unknown as SwapActor;
		await embedFromPack(commander, 'nimble-classes', 'Commander');
		await settle();

		for (const name of [
			'Face Me!',
			'Fit for Any Battlefield',
			'Heavy Strike',
			'+1 Max Combat Die',
			'Rigorous Training',
		]) {
			await embedFromPack(commander, 'nimble-class-features', name);
		}
		// Every entry is empty: the GM dragged the items on, no level granted them.
		await levelTo(commander, 8);
	}, 120_000);

	afterAll(async () => {
		await commander.sheet.close().catch(() => {});
	});

	test('the rest window shows what the sheet holds against what the levels grant', async () => {
		const dialog = await openRestDialog(commander, 'safe');
		await expandOptions(dialog);
		const pool = poolSection(dialog, 'Fit for Any Battlefield');

		// Levels 2, 4, 6 and 8 grant five picks. The sheet holds an Order, a Tactic and a die.
		expect(cardNamed(dialog, 'Rigorous Training')).toBeTruthy();
		expect(countText(pool)).toBe('3 / 5');
		expect(placeNames(pool)).toHaveLength(5);
		expect(emptyPlaces(pool)).toBe(2);
		expect(pool.textContent).toContain(
			'Your level gives you 5 options. You have 3. Choose 2 more.',
		);
		expect(pool.querySelector('[aria-label="Give up Heavy Strike"]')).not.toBeNull();

		await closeWithoutResting(dialog);
	}, 60_000);

	test('a fill takes a second die without giving anything up, and records nothing', async () => {
		const historyBefore = historyIds(commander);

		const dialog = await openRestDialog(commander, 'safe');
		await expandOptions(dialog);
		const pool = poolSection(dialog, 'Fit for Any Battlefield');

		// A place already stands empty, so the die can be taken with nothing given up.
		await choose(pool, '+1 Max Combat Die');
		expect(countText(pool)).toBe('4 / 5');
		expect(hintText(pool)).toContain('You take +1 Max Combat Die.');
		const message = await confirmRest(commander, dialog, 'safeRest');

		await waitFor(
			() => ownedNamed(commander, '+1 Max Combat Die').length === 2,
			'the second die to be granted',
		);
		expect(ownedNamed(commander, 'Heavy Strike')).toHaveLength(1);
		await waitFor(() => dieBonusOf(commander) === 2, 'the pool bonus to rise by one');
		// No entry vacated anything, so the history is exactly as it was: empty.
		expect(historyIds(commander)).toEqual(historyBefore);
		expect(message?.system.optionChanges).toEqual([
			expect.objectContaining({ removed: [], added: ['+1 Max Combat Die'] }),
		]);
	}, 90_000);

	test('a trade on a sheet no entry records swaps the item and records nothing', async () => {
		const historyBefore = historyIds(commander);

		const dialog = await openRestDialog(commander, 'safe');
		await expandOptions(dialog);
		const pool = poolSection(dialog, 'Fit for Any Battlefield');

		await giveUp(pool, 'Heavy Strike');
		await choose(pool, 'Sweeping Strike');
		expect(countText(pool)).toBe('4 / 5');
		expect(hintText(pool)).toContain('You give up Heavy Strike and take Sweeping Strike.');
		const message = await confirmRest(commander, dialog, 'safeRest');

		await waitFor(
			() => ownedNamed(commander, 'Sweeping Strike').length === 1,
			'the replacement to be granted',
		);
		expect(ownedNamed(commander, 'Heavy Strike')).toHaveLength(0);
		expect(ownedNamed(commander, '+1 Max Combat Die')).toHaveLength(2);
		// The released pick sat in no entry, so the replacement has none to inherit.
		expect(historyIds(commander)).toEqual(historyBefore);
		expect(message?.system.optionChanges).toEqual([
			expect.objectContaining({ removed: ['Heavy Strike'], added: ['Sweeping Strike'] }),
		]);
	}, 90_000);
});

describe('a Commander whose die was deleted by hand', () => {
	let commander: SwapActor;
	let dieItems: SwapItem[];

	const banner = () =>
		commander.sheet.element.querySelector<HTMLElement>('.nimble-level-correction-warning');

	beforeAll(async () => {
		commander = (await Actor.create({
			name: `${TEST_PREFIX} Commander Short a Die`,
			type: 'character',
			system: { abilities: { strength: { baseValue: 3 } } },
		} as Actor.CreateData)) as unknown as SwapActor;
		await embedFromPack(commander, 'nimble-classes', 'Commander');
		await settle();

		const orders = await Promise.all(
			['Face Me!', 'Hold the Line!'].map((name) =>
				embedFromPack(commander, 'nimble-class-features', name),
			),
		);
		const poolItem = await embedFromPack(
			commander,
			'nimble-class-features',
			'Fit for Any Battlefield',
		);
		const tactic = await embedFromPack(commander, 'nimble-class-features', 'Heavy Strike');
		const training = await embedFromPack(commander, 'nimble-class-features', 'Rigorous Training');
		dieItems = [
			await embedFromPack(commander, 'nimble-class-features', '+1 Max Combat Die'),
			await embedFromPack(commander, 'nimble-class-features', '+1 Max Combat Die'),
		];
		// Level 6 also grants a Weapon Mastery, so the only shortfall is the die that goes missing.
		const mastery = await Promise.all(
			['Weapon Mastery', 'Slashing'].map((name) =>
				embedFromPack(commander, 'nimble-class-features', name),
			),
		);
		await levelTo(commander, 8, {
			2: orders.map((item) => item.id),
			4: [poolItem.id, tactic.id, training.id],
			6: [dieItems[0]!.id, ...mastery.map((item) => item.id)],
			8: [dieItems[1]!.id],
		});

		// The GM deletes the level 6 die by hand. Its id stays in the history, dead.
		await (commander as unknown as Actor).deleteEmbeddedDocuments('Item', [dieItems[0]!.id]);
		await settle();
	}, 120_000);

	afterAll(async () => {
		await commander.sheet.close().catch(() => {});
	});

	test('the sheet warns, the window says four of five, and a fill takes the fifth', async () => {
		expect(ownedNamed(commander, '+1 Max Combat Die')).toHaveLength(1);
		expect(historyIds(commander)).toContain(dieItems[0]!.id);

		const dialog = await openRestDialog(commander, 'safe');
		await waitFor(() => banner() !== null, 'the missing level choices banner');
		await expandOptions(dialog);
		const pool = poolSection(dialog, 'Fit for Any Battlefield');

		expect(countText(pool)).toBe('4 / 5');
		expect(emptyPlaces(pool)).toBe(1);
		expect(pool.textContent).toContain(
			'Your level gives you 5 options. You have 4. Choose 1 more.',
		);
		await unfold(pool);
		// A place stands empty, so the choices are live without a give-up.
		expect(choiceControl(pool, 'Sweeping Strike')?.hasAttribute('disabled')).toBe(false);
		await choose(pool, 'Sweeping Strike');
		expect(countText(pool)).toBe('5 / 5');
		expect(emptyPlaces(pool)).toBe(0);
		const message = await confirmRest(commander, dialog, 'safeRest');

		await waitFor(
			() => ownedNamed(commander, 'Sweeping Strike').length === 1,
			'the fill to be granted',
		);
		expect(ownedNamed(commander, '+1 Max Combat Die')).toHaveLength(1);
		// A fill vacates no entry, so the new pick is recorded nowhere and the dead id stays.
		const granted = ownedNamed(commander, 'Sweeping Strike')[0]!;
		expect(historyIds(commander)).not.toContain(granted.id);
		expect(historyIds(commander)).toContain(dieItems[0]!.id);
		expect(message?.system.optionChanges).toEqual([
			expect.objectContaining({ removed: [], added: ['Sweeping Strike'] }),
		]);

		await commander.sheet.render(true);
		await settle(800);
		expect(banner()).toBeNull();
	}, 120_000);

	test('trading a level 2 Order for a die is allowed, and the sheet does not warn', async () => {
		const dialog = await openRestDialog(commander, 'safe');
		await expandOptions(dialog);
		const pool = poolSection(dialog, 'Fit for Any Battlefield');

		expect(pool.querySelector('.nimble-hint--warning')).toBeNull();
		await giveUp(pool, 'Hold the Line!');
		await choose(pool, '+1 Max Combat Die');
		expect(countText(pool)).toBe('5 / 5');
		// The books leave a narrowly worded level to the table, so the window says nothing of it.
		expect(pool.querySelector('.nimble-hint--warning')).toBeNull();
		expect(hintText(pool)).toContain('You give up Hold the Line! and take +1 Max Combat Die.');

		const message = await confirmRest(commander, dialog, 'safeRest');

		await waitFor(
			() => ownedNamed(commander, '+1 Max Combat Die').length === 2,
			'the second die to be granted',
		);
		expect(ownedNamed(commander, 'Hold the Line!')).toHaveLength(0);
		expect(message?.system.optionChanges).toEqual([
			expect.objectContaining({ removed: ['Hold the Line!'], added: ['+1 Max Combat Die'] }),
		]);

		await commander.sheet.render(true);
		await settle(800);
		expect(banner()).toBeNull();
	}, 120_000);
});

describe('a Commander whose Order also moves a skill point', () => {
	let commander: SwapActor;

	beforeAll(async () => {
		commander = (await Actor.create({
			name: `${TEST_PREFIX} Commander of Skills`,
			type: 'character',
			system: { skills: { arcana: { points: 2 }, stealth: { points: 0 } } },
		} as Actor.CreateData)) as unknown as SwapActor;
		await embedFromPack(commander, 'nimble-classes', 'Commander');
		await settle();

		const orders = await Promise.all(
			['Face Me!', 'Hold the Line!'].map((name) =>
				embedFromPack(commander, 'nimble-class-features', name),
			),
		);
		const poolItem = await embedFromPack(
			commander,
			'nimble-class-features',
			'Fit for Any Battlefield',
		);
		const training = await embedFromPack(commander, 'nimble-class-features', 'Rigorous Training');

		// No shipped feature both stands in a pool and moves a skill point, so the Order is given
		// the move rule here.
		const faceMe = orders[0]!;
		const packRules = ((faceMe as unknown as Item).toObject() as { system: { rules?: unknown[] } })
			.system.rules;
		await (commander as unknown as Actor).updateEmbeddedDocuments('Item', [
			{
				_id: faceMe.id,
				'system.rules': [
					...(packRules ?? []),
					{
						id: foundry.utils.randomID(),
						type: 'skillPointMove',
						points: 1,
						trigger: 'safeRest',
					},
				],
			} as unknown as Item.UpdateData,
		]);
		await settle();

		// Level 8, where the levels merge the Orders and the Tactics into one pool, so the Order
		// stands in a place of the pool the swap feature offers.
		await levelTo(commander, 8, {
			2: orders.map((item) => item.id),
			4: [poolItem.id, training.id],
		});
	}, 120_000);

	afterAll(async () => {
		await commander.sheet.close().catch(() => {});
	});

	test('giving up the feature that moves the skill point switches its card off', async () => {
		const dialog = await openRestDialog(commander, 'safe');
		await expandOptions(dialog);

		// The Order has its own card, because it is what offers the move.
		const card = cardNamed(dialog, 'Face Me!');
		expect(card.textContent).toContain('Move a point');
		chooseSkill(skillSelect(card, 'from a skill')!, 'arcana');
		await settle(200);
		chooseSkill(skillSelect(card, 'to a skill')!, 'stealth');
		await settle(200);
		expect(card.querySelector('.nimble-skill-move__result')?.textContent).toContain('Arcana');

		// The same Order is a pick in the pool the other card holds.
		const pool = poolSection(dialog, 'Fit for Any Battlefield');
		await giveUp(pool, 'Face Me!');

		const givenUp = cardNamed(dialog, 'Face Me!');
		expect(givenUp.className).toContain('card--given-up');
		expect(givenUp.textContent).toContain(
			'You are giving up Face Me!. What it lets you do is not offered on this rest.',
		);
		// The point it moved goes back, so the line it moved on is gone.
		expect(skillSelect(givenUp, 'from a skill')).toBeNull();
		expect(skillSelect(givenUp, 'to a skill')).toBeNull();

		await closeWithoutResting(dialog);
		await settle(500);
		expect(commander.system.skills.arcana.points).toBe(2);
		expect(commander.system.skills.stealth.points).toBe(0);
	}, 90_000);
});

describe('a Berserker with a two-pick pool', () => {
	let berserker: SwapActor;

	beforeAll(async () => {
		berserker = (await Actor.create({
			name: `${TEST_PREFIX} Berserker`,
			type: 'character',
		} as Actor.CreateData)) as unknown as SwapActor;
		await embedFromPack(berserker, 'nimble-classes', 'Berserker');
		await settle();

		const rampage = await embedFromPack(berserker, 'nimble-class-features', 'Rampage');
		const whirlwind = await embedFromPack(berserker, 'nimble-class-features', 'Whirlwind');
		const wrath = await embedFromPack(berserker, 'nimble-class-features', 'Wrath & Ruin');
		await levelTo(berserker, 8, { 4: [rampage.id, wrath.id], 6: [whirlwind.id] });
	}, 120_000);

	afterAll(async () => {
		await berserker.sheet.close().catch(() => {});
	});

	test('unfolding a pool through its row pulls the window back inside the viewport', async () => {
		const dialog = await openRestDialog(berserker, 'safe');
		await expandOptions(dialog);
		const app = restApp('safe');
		const topBefore = await pinToViewportBottom(dialog, app);
		const viewportHeight = document.documentElement.clientHeight;
		expect(bottomOf(dialog)).toBeLessThanOrEqual(viewportHeight + 1);

		const pool = poolSection(dialog, 'Savage Arsenal');
		await unfold(pool);

		await waitFor(() => app.position.top < topBefore, 'the window to move up as the pool unfolds');
		expect(bottomOf(dialog)).toBeLessThanOrEqual(viewportHeight + 1);

		await closeWithoutResting(dialog);
	}, 60_000);

	test('giving a pick up unfolds the pool and pulls the window back inside the viewport', async () => {
		const dialog = await openRestDialog(berserker, 'safe');
		await expandOptions(dialog);
		const app = restApp('safe');
		const topBefore = await pinToViewportBottom(dialog, app);
		const viewportHeight = document.documentElement.clientHeight;

		const pool = poolSection(dialog, 'Savage Arsenal');
		await giveUp(pool, 'Whirlwind');

		expect(choiceControl(pool, 'Whirlwind')).not.toBeNull();
		await waitFor(() => app.position.top < topBefore, 'the window to move up as the pool unfolds');
		expect(bottomOf(dialog)).toBeLessThanOrEqual(viewportHeight + 1);

		await closeWithoutResting(dialog);
	}, 60_000);

	test('an ability with a pick is never offered again, so it cannot be taken twice', async () => {
		const dialog = await openRestDialog(berserker, 'safe');
		await expandOptions(dialog);
		const pool = poolSection(dialog, 'Savage Arsenal');
		await unfold(pool);

		// No arsenal ability may be taken more than once, so a held one stands in its place and
		// nowhere among the choices.
		expect(pool.querySelector('[aria-label="Give up Rampage"]')).not.toBeNull();
		expect(pool.querySelector('[aria-label="Give up Whirlwind"]')).not.toBeNull();
		expect(choiceControl(pool, 'Rampage')).toBeNull();
		expect(choiceControl(pool, 'Whirlwind')).toBeNull();
		expect(choiceControl(pool, 'Death Blow')).not.toBeNull();

		await closeWithoutResting(dialog);
	}, 60_000);

	test('giving a pick up without replacing it changes nothing and posts no change', async () => {
		const dialog = await openRestDialog(berserker, 'safe');
		await expandOptions(dialog);
		const pool = poolSection(dialog, 'Savage Arsenal');

		await giveUp(pool, 'Whirlwind');
		expect(hintText(pool)).toContain('Choose 1 more option to complete the swap.');
		const message = await confirmRest(berserker, dialog, 'safeRest');

		expect(ownedNamed(berserker, 'Whirlwind')).toHaveLength(1);
		expect(ownedNamed(berserker, 'Rampage')).toHaveLength(1);
		expect(message?.system.optionChanges ?? []).toEqual([]);
	}, 60_000);

	test('closing the dialog discards a finished selection', async () => {
		const dialog = await openRestDialog(berserker, 'safe');
		await expandOptions(dialog);
		const pool = poolSection(dialog, 'Savage Arsenal');

		await giveUp(pool, 'Whirlwind');
		await choose(pool, 'Death Blow');
		await closeWithoutResting(dialog);
		await settle(500);

		expect(ownedNamed(berserker, 'Whirlwind')).toHaveLength(1);
		expect(ownedNamed(berserker, 'Death Blow')).toHaveLength(0);
	}, 60_000);

	test('replacing one of two picks keeps the other and reports the swap', async () => {
		const dialog = await openRestDialog(berserker, 'safe');
		await expandOptions(dialog);
		const pool = poolSection(dialog, 'Savage Arsenal');

		await giveUp(pool, 'Whirlwind');
		await choose(pool, 'Death Blow');
		const message = await confirmRest(berserker, dialog, 'safeRest');

		await waitFor(
			() => ownedNamed(berserker, 'Death Blow').length === 1,
			'Death Blow to be granted',
		);
		expect(ownedNamed(berserker, 'Whirlwind')).toHaveLength(0);
		expect(ownedNamed(berserker, 'Rampage')).toHaveLength(1);

		const deathBlow = ownedNamed(berserker, 'Death Blow')[0]!;
		expect(
			berserker.system.levelUpHistory.find((entry) =>
				entry.grantedFeatureIds.includes(deathBlow.id),
			)?.level,
		).toBe(6);
		expect(message?.system.optionChanges).toEqual([
			expect.objectContaining({
				label: 'Savage Arsenal',
				removed: ['Whirlwind'],
				added: ['Death Blow'],
			}),
		]);
	}, 90_000);

	test('a swap whose pick left the history while the window was open is still applied', async () => {
		const rampage = ownedNamed(berserker, 'Rampage')[0]!;
		const historyBefore = berserker.system.levelUpHistory.map((entry) => ({ ...entry }));

		const dialog = await openRestDialog(berserker, 'safe');
		await expandOptions(dialog);
		const pool = poolSection(dialog, 'Savage Arsenal');
		await unfold(pool);

		// The offer was computed on open. Now the entry that recorded Rampage stops naming it,
		// as a level revert on another client would make it.
		await berserker.update({
			'system.levelUpHistory': historyBefore.map((entry) => ({
				...entry,
				grantedFeatureIds: entry.grantedFeatureIds.filter((id) => id !== rampage.id),
			})),
		});
		await settle();

		await giveUp(pool, 'Rampage');
		await choose(pool, 'Whirlwind');

		const warnings: string[] = [];
		const notifications = ui.notifications as unknown as { warn(text: string): unknown };
		const warn = notifications.warn;
		notifications.warn = (text: string) => {
			warnings.push(text);
			return warn.call(notifications, text);
		};
		let message: RestMessage | undefined;
		try {
			message = await confirmRest(berserker, dialog, 'safeRest');
		} finally {
			notifications.warn = warn;
		}

		// The sheet is what counts. Rampage goes, Whirlwind comes, and the replacement is
		// recorded nowhere because the pick it replaced was in no entry.
		await waitFor(() => ownedNamed(berserker, 'Whirlwind').length === 1, 'Whirlwind to return');
		expect(ownedNamed(berserker, 'Rampage')).toHaveLength(0);
		expect(historyIds(berserker)).not.toContain(ownedNamed(berserker, 'Whirlwind')[0]!.id);
		expect(message?.system.optionChanges).toEqual([
			expect.objectContaining({ removed: ['Rampage'], added: ['Whirlwind'] }),
		]);
		expect(warnings).toEqual([]);
	}, 90_000);

	test('level down removes the replacement that inherited an entry and leaves the untracked one', async () => {
		// Death Blow took over the level 6 entry Whirlwind vacated earlier. Whirlwind is untracked.
		expect(ownedNamed(berserker, 'Death Blow')).toHaveLength(1);
		while (berserker.levels.character > 5) {
			await berserker.revertLastLevelUp();
			await settle(300);
		}
		expect(ownedNamed(berserker, 'Death Blow')).toHaveLength(0);
		expect(ownedNamed(berserker, 'Whirlwind')).toHaveLength(1);
	}, 90_000);
});

describe('a Songweaver moves a skill point with Jack of All Trades', () => {
	let songweaver: SwapActor;

	beforeAll(async () => {
		songweaver = (await Actor.create({
			name: `${TEST_PREFIX} Songweaver`,
			type: 'character',
			system: { skills: { arcana: { points: 2 }, stealth: { points: 0 } } },
		} as Actor.CreateData)) as unknown as SwapActor;
		await embedFromPack(songweaver, 'nimble-classes', 'Songweaver');
		await settle();

		const joat = await embedFromPack(songweaver, 'nimble-class-features', 'Jack of All Trades');
		await levelTo(songweaver, 2, { 2: [joat.id] });
	}, 120_000);

	afterAll(async () => {
		await songweaver.sheet.close().catch(() => {});
	});

	test('a point taken from one skill and given to another moves on the rest and posts both halves', async () => {
		const arcanaBefore = songweaver.system.skills.arcana.points;
		const stealthBefore = songweaver.system.skills.stealth.points;

		const dialog = await openRestDialog(songweaver, 'safe');
		await expandOptions(dialog);

		const card = cardNamed(dialog, 'Jack of All Trades');
		// The point has nowhere to go until a skill is chosen to give it.
		expect(skillSelect(card, 'to a skill')!.disabled).toBe(true);
		chooseSkill(skillSelect(card, 'from a skill')!, 'arcana');
		await waitFor(
			() => !skillSelect(card, 'to a skill')!.disabled,
			'the point to become placeable',
		);
		chooseSkill(skillSelect(card, 'to a skill')!, 'stealth');
		await settle(200);

		const summary = card.querySelector('.nimble-skill-move__result')?.textContent ?? '';
		expect(summary).toContain('Arcana');
		expect(summary).toContain('Stealth');

		const message = await confirmRest(songweaver, dialog, 'safeRest');

		await waitFor(
			() => songweaver.system.skills.stealth.points === stealthBefore + 1,
			'the point to reach Stealth',
		);
		expect(songweaver.system.skills.arcana.points).toBe(arcanaBefore - 1);
		expect(message?.system.optionChanges).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					label: 'Arcana',
					removed: [`${arcanaBefore} to ${arcanaBefore - 1}`],
				}),
				expect.objectContaining({
					label: 'Stealth',
					added: [`${stealthBefore} to ${stealthBefore + 1}`],
				}),
			]),
		);
	}, 90_000);

	test('a point cannot leave a skill that holds none', async () => {
		const dialog = await openRestDialog(songweaver, 'safe');
		await expandOptions(dialog);

		const from = skillSelect(cardNamed(dialog, 'Jack of All Trades'), 'from a skill')!;
		const offered = [...from.options].map((option) => option.value);
		expect(offered).toContain('arcana');
		expect(offered).not.toContain('naturecraft');
		await closeWithoutResting(dialog);
	}, 60_000);
});

async function closeWithoutResting(dialog: HTMLElement) {
	dialog.querySelector<HTMLButtonElement>('.window-header [data-action="close"]')!.click();
	await waitFor(() => !document.body.contains(dialog), 'the dialog to close');
}
