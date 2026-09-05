/**
 * Live regression tests for swapping class options on a rest, driven through the real
 * Safe Rest and Field Rest dialogs: the sheet's rest button is clicked, the "Change my
 * options" row is expanded, picks are deselected and selected through the option cards,
 * and the dialog's own rest button confirms. The unit suite pins the planner and the
 * summary against fixtures; what needs a live world is the whole path from a click to
 * the embedded items, the level-up history, the charge pool, and the chat card.
 *
 * The characters are built the way the level-up path leaves them: a class item at the
 * target level, one history entry per level, and the picks recorded against the entries
 * that granted them.
 */

import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { messageFromFlow, purgeTestDocuments, settle, waitFor } from './liveHelpers.ts';

const TEST_PREFIX = 'V14 Option Swap';

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
 * compendium does. The swap identifies a character's picks by that source.
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

async function clickCard(pool: HTMLElement, ariaLabel: string) {
	await waitFor(() => pool.querySelector(`[aria-label="${ariaLabel}"]`) !== null, `"${ariaLabel}"`);
	pool.querySelector<HTMLButtonElement>(`[aria-label="${ariaLabel}"]`)!.click();
	await settle(200);
}

async function unfold(pool: HTMLElement) {
	pool.querySelector<HTMLButtonElement>('.nimble-option-swap__unfold')!.click();
	await settle(200);
}

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

describe('a Commander trades a max Combat Die pick for a Combat Ability', () => {
	let commander: SwapActor;
	let dieItems: SwapItem[];
	let tacticItem: SwapItem;

	// The pool's maximum is derived from the poolMaxBonus rules the character holds, one per
	// die item, so the rules are the observable the swap has to move.
	const dieBonus = () => {
		const rules =
			commander.rules instanceof Map ? [...commander.rules.values()] : [...commander.rules];
		return rules.filter(
			(rule) =>
				rule.type === 'poolMaxBonus' &&
				rule.appliesToPool?.('combat-dice') !== false &&
				rule.poolIdentifier === 'combat-dice',
		).length;
	};

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
		tacticItem = await embedFromPack(commander, 'nimble-class-features', 'Heavy Strike');
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

	test('the dialog offers one merged pool holding orders, tactics, and the die', async () => {
		const dialog = await openRestDialog(commander, 'safe');
		await expandOptions(dialog);

		const pool = poolSection(dialog, 'Fit for Any Battlefield');
		const held = [...pool.querySelectorAll('[aria-label^="Deselect "]')].map((button) =>
			button.getAttribute('aria-label'),
		);
		// Two orders, two tactics, and the die as one pick however many copies are held.
		expect(held).toEqual(
			expect.arrayContaining([
				'Deselect Face Me!',
				'Deselect Hold the Line!',
				'Deselect Heavy Strike',
				'Deselect Lunging Strike',
				'Deselect +1 Max Combat Die',
			]),
		);
		expect(held).toHaveLength(5);
		expect(pool.querySelector('.nimble-option-swap__pool-progress')?.textContent).toContain(
			'5 of 5',
		);

		// The die must not also be offered under its own heading.
		const headings = [...dialog.querySelectorAll('.nimble-option-swap__pool .nimble-heading')].map(
			(heading) => heading.textContent?.trim(),
		);
		expect(headings.filter((heading) => heading?.includes('Fit for Any Battlefield'))).toHaveLength(
			1,
		);

		await closeWithoutResting(dialog);
	}, 60_000);

	test('a plain safe rest changes no options and posts no change', async () => {
		const dialog = await openRestDialog(commander, 'safe');
		const message = await confirmRest(commander, dialog, 'safeRest');

		expect(message?.system.optionChanges ?? []).toEqual([]);
		expect(ownedNamed(commander, '+1 Max Combat Die')).toHaveLength(2);
		expect(dieBonus()).toBe(2);
	}, 60_000);

	test('swapping the die for a Combat Ability removes one copy and one point of pool bonus', async () => {
		const historyBefore = historyIds(commander);

		const dialog = await openRestDialog(commander, 'safe');
		await expandOptions(dialog);
		const pool = poolSection(dialog, 'Fit for Any Battlefield');

		await unfold(pool);
		// The pool is full, so the alternatives stay greyed until a pick is released.
		expect(
			pool.querySelector('[aria-label="Select Sweeping Strike"]')?.closest('.disabled'),
		).not.toBeNull();
		await clickCard(pool, 'Deselect +1 Max Combat Die');
		await clickCard(pool, 'Select Sweeping Strike');

		const message = await confirmRest(commander, dialog, 'safeRest');

		await waitFor(
			() => ownedNamed(commander, 'Sweeping Strike').length === 1,
			'the tactic to be granted',
		);
		expect(ownedNamed(commander, '+1 Max Combat Die')).toHaveLength(1);

		// One die item fewer is one poolMaxBonus rule fewer, which is what the pool's maximum reads.
		await waitFor(() => dieBonus() === 1, 'the pool bonus to drop by one');

		// The replacement took over the history entry of the die it replaced.
		const deletedId = dieItems.map((item) => item.id).find((id) => !commander.items.get(id))!;
		const granted = ownedNamed(commander, 'Sweeping Strike')[0]!;
		const historyAfter = historyIds(commander);
		expect(historyAfter).not.toContain(deletedId);
		expect(historyAfter).toContain(granted.id);
		expect(historyAfter).toHaveLength(historyBefore.length);
		const vacated = commander.system.levelUpHistory.find((entry) =>
			entry.grantedFeatureIds.includes(granted.id),
		);
		expect([6, 8]).toContain(vacated?.level);

		expect(message?.system.optionChanges).toEqual([
			expect.objectContaining({ removed: ['+1 Max Combat Die'], added: ['Sweeping Strike'] }),
		]);
		const card = document.querySelector(`#chat [data-message-id="${message!.id}"]`);
		expect(card?.querySelector('.option-changes__removed')?.textContent).toBe('+1 Max Combat Die');
		expect(card?.querySelector('.option-changes__added')?.textContent).toBe('Sweeping Strike');
	}, 90_000);

	test('levelling down removes whatever the vacated level now records', async () => {
		const granted = ownedNamed(commander, 'Sweeping Strike')[0]!;
		const vacatedLevel = commander.system.levelUpHistory.find((entry) =>
			entry.grantedFeatureIds.includes(granted.id),
		)!.level;

		while (commander.levels.character >= vacatedLevel) {
			await commander.revertLastLevelUp();
			await settle(300);
		}

		expect(commander.levels.character).toBe(vacatedLevel - 1);
		expect(ownedNamed(commander, 'Sweeping Strike')).toHaveLength(0);
	}, 90_000);

	test('a field rest offers no swap when the feature only names the safe rest', async () => {
		const dialog = await openRestDialog(commander, 'field');
		await settle(800);

		expect(dialog.querySelector('.nimble-option-swap')).toBeNull();
		await closeWithoutResting(dialog);
	}, 60_000);
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

	test('releasing a pick without replacing it changes nothing and posts no change', async () => {
		const dialog = await openRestDialog(berserker, 'safe');
		await expandOptions(dialog);
		const pool = poolSection(dialog, 'Savage Arsenal');

		await clickCard(pool, 'Deselect Whirlwind');
		const message = await confirmRest(berserker, dialog, 'safeRest');

		expect(ownedNamed(berserker, 'Whirlwind')).toHaveLength(1);
		expect(ownedNamed(berserker, 'Rampage')).toHaveLength(1);
		expect(message?.system.optionChanges ?? []).toEqual([]);
	}, 60_000);

	test('closing the dialog discards a finished selection', async () => {
		const dialog = await openRestDialog(berserker, 'safe');
		await expandOptions(dialog);
		const pool = poolSection(dialog, 'Savage Arsenal');

		await unfold(pool);
		await clickCard(pool, 'Deselect Whirlwind');
		await clickCard(pool, 'Select Death Blow');
		await closeWithoutResting(dialog);
		await settle(500);

		expect(ownedNamed(berserker, 'Whirlwind')).toHaveLength(1);
		expect(ownedNamed(berserker, 'Death Blow')).toHaveLength(0);
	}, 60_000);

	test('replacing one of two picks keeps the other and reports the swap', async () => {
		const dialog = await openRestDialog(berserker, 'safe');
		await expandOptions(dialog);
		const pool = poolSection(dialog, 'Savage Arsenal');

		await unfold(pool);
		await clickCard(pool, 'Deselect Whirlwind');
		await clickCard(pool, 'Select Death Blow');
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

		const give = () =>
			dialog.querySelector<HTMLButtonElement>('[aria-label="Give a point to Stealth"]')!;
		expect(give().disabled).toBe(true);
		dialog.querySelector<HTMLButtonElement>('[aria-label="Take a point from Arcana"]')!.click();
		await waitFor(() => !give().disabled, 'the taken point to become placeable');
		give().click();
		await settle(200);

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
					removed: [`Arcana ${arcanaBefore} to ${arcanaBefore - 1}`],
				}),
				expect.objectContaining({
					label: 'Stealth',
					added: [`Stealth ${stealthBefore} to ${stealthBefore + 1}`],
				}),
			]),
		);
	}, 90_000);

	test('a point cannot leave a skill that holds none', async () => {
		const dialog = await openRestDialog(songweaver, 'safe');
		await expandOptions(dialog);

		const take = dialog.querySelector<HTMLButtonElement>(
			'[aria-label="Take a point from Naturecraft"]',
		);
		expect(take?.disabled).toBe(true);
		await closeWithoutResting(dialog);
	}, 60_000);
});

async function closeWithoutResting(dialog: HTMLElement) {
	dialog.querySelector<HTMLButtonElement>('.window-header [data-action="close"]')!.click();
	await waitFor(() => !document.body.contains(dialog), 'the dialog to close');
}
