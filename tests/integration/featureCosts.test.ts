/**
 * Feature costs (#1004) through the real character sheet and roll windows on live Foundry V14.
 *
 * Each use under test starts from a click on the sheet row and goes through the roll window's
 * own controls: the Spellshaper dropdown, the Zealot steppers and the Spend buttons. The API
 * only builds the characters, places tokens and reads the results. The features are the real
 * pack items, so the test also proves the pack rules reach the dialogs.
 */

import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest';
import { buildCharacter, type CharacterActor } from './builders/buildCharacter.ts';
import {
	clearTargets,
	createViewedTestScene,
	getAutomationToggle,
	importPackItem,
	placeToken,
	purgeTestDocuments,
	setAutomationToggle,
	settle,
	targetToken,
	waitFor,
} from './liveHelpers.ts';

const TEST_PREFIX = 'V14 Feature Costs';

/** The costs are checked and spent only with this world setting on. */
const RESOURCE_SPENDING_SETTING = 'automation.resourceSpending';
let resourceSpendingBefore: boolean | null = null;

beforeAll(async () => {
	resourceSpendingBefore = getAutomationToggle(RESOURCE_SPENDING_SETTING);
	await setAutomationToggle(RESOURCE_SPENDING_SETTING, true);
});

const t = (key: string, data?: Record<string, string>) =>
	data ? game.i18n.format(key, data) : game.i18n.localize(key);

interface SheetActor extends CharacterActor {
	sheet: {
		element: HTMLElement;
		render(options: object): Promise<unknown>;
		setPosition(position: object): unknown;
		close(): Promise<unknown>;
	};
	system: CharacterActor['system'] & {
		attributes: { hp: { value: number; max: number; temp: number } };
	};
}

interface CardMessage {
	id: string;
	speaker?: { alias?: string };
	system: { costs?: Array<{ kind: string; amount: number; source: string }> };
}

const rollWindowRoot = () =>
	[...document.querySelectorAll<HTMLElement>('.application.nimble-roll-window')].at(-1) ?? null;

const buttonNamed = (root: ParentNode, name: string) =>
	[...root.querySelectorAll<HTMLButtonElement>('button')].find(
		(button) => button.getAttribute('aria-label') === name || button.textContent?.trim() === name,
	);

async function openSheet(actor: SheetActor): Promise<HTMLElement> {
	await actor.sheet.render({ force: true });
	await waitFor(() => !!actor.sheet.element?.querySelector('[role="tab"]'), 'the sheet to render');
	actor.sheet.setPosition({ left: 40, top: 40, width: 760, height: 900 });
	await settle(300);
	return actor.sheet.element;
}

/** Click the sheet tab, then the row's use button: what a player does. */
async function useFromSheet(
	actor: SheetActor,
	tabKey: string,
	itemId: string,
): Promise<HTMLElement> {
	const sheet = await openSheet(actor);
	const name = t(`NIMBLE.actorSheet.hero.tabs.${tabKey}`);
	const tab = [...sheet.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((each) =>
		(each.getAttribute('aria-label') || each.textContent || '').trim().startsWith(name),
	);
	if (!tab) throw new Error(`no ${name} tab on the sheet`);
	tab.click();
	await waitFor(
		() => !!sheet.querySelector(`[data-row-id="${CSS.escape(itemId)}"]`),
		`the row of item ${itemId} on the ${name} tab`,
	);
	const row = sheet.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(itemId)}"]`)!;
	row.querySelector<HTMLButtonElement>('button.use, button.main')!.click();
	await waitFor(() => !!rollWindowRoot(), 'the roll window to open', { timeout: 15_000 });
	await settle(500);
	return rollWindowRoot()!;
}

async function pressRoll(root: HTMLElement): Promise<void> {
	const roll = root.querySelector<HTMLButtonElement>('.foot button:last-of-type');
	expect(roll, 'the roll window has its roll button').toBeTruthy();
	roll!.click();
	await settle(900);
}

async function newCard(actor: SheetActor, before: Set<string>): Promise<CardMessage> {
	const find = () =>
		(game.messages.contents as unknown as CardMessage[]).find(
			(message) => !before.has(message.id) && message.speaker?.alias === actor.name,
		);
	await waitFor(() => !!find(), `a card from ${actor.name}`, { timeout: 20_000 });
	await settle(800);
	return find()!;
}

const messageIds = () => new Set(game.messages.contents.map((message) => message.id!));

/** The text of the card's cost section, as the chat log shows it. */
function costLines(messageId: string): string {
	const nodes = document.querySelectorAll(`[data-message-id="${messageId}"] .nimble-cost-lines`);
	return [...nodes].map((node) => node.textContent?.replace(/\s+/g, ' ').trim() ?? '').join(' | ');
}

const manaOf = (actor: SheetActor) => actor.system.resources.mana.current;

/** Soft, so the checks after it (mana, damage) still run and report. */
async function expectCostLine(messageId: string, text: string): Promise<void> {
	await waitFor(() => costLines(messageId).includes(text), `"${text}" on the card`, {
		timeout: 5_000,
	}).catch(() => undefined);
	expect.soft(costLines(messageId)).toContain(text);
}

afterEach(async () => {
	for (const app of [...foundry.applications.instances.values()] as Array<{
		hasFrame?: boolean;
		element?: HTMLElement;
		close(): Promise<unknown>;
	}>) {
		if (app.hasFrame && app.element?.classList.contains('nimble-roll-window')) await app.close();
	}
	await settle(200);
});

describe('a Spellshaper ability chosen in the cast window', () => {
	let mage: SheetActor;

	beforeAll(async () => {
		await purgeTestDocuments(TEST_PREFIX);
		mage = (await buildCharacter({
			name: `${TEST_PREFIX} Mage`,
			className: 'Mage',
			level: 4,
		})) as SheetActor;
		await importPackItem(mage as never, 'nimble-class-features', (e) => e.name === 'Stretch Time');
		await importPackItem(mage as never, 'nimble-spells', (e) => e.name === 'Ignite');
		await settle();
	}, 120_000);

	afterAll(async () => {
		await mage?.sheet.close();
	});

	test('spends the spell tier and the ability mana, and the card says what the ability cost', async () => {
		const ignite = mage.items.contents.find((item) => item.name === 'Ignite')!;
		const manaBefore = manaOf(mage);
		expect(manaBefore).toBeGreaterThanOrEqual(3);

		const root = await useFromSheet(mage, 'spells', ignite.id);
		const select = [...root.querySelectorAll<HTMLSelectElement>('.option-group select')].find(
			(each) => [...each.options].some((option) => option.text.startsWith('Stretch Time')),
		);
		expect(select, 'the cast window lists Stretch Time in the Spellshaper dropdown').toBeTruthy();
		const entry = [...select!.options].find((option) => option.text.startsWith('Stretch Time'))!;
		expect(entry.text).toBe('Stretch Time (2 mana)');
		select!.value = entry.value;
		select!.dispatchEvent(new Event('change', { bubbles: true }));
		await settle(300);

		const before = messageIds();
		await pressRoll(root);
		const card = await newCard(mage, before);

		expect(manaOf(mage)).toBe(manaBefore - 1 - 2);
		expect(card.system.costs).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ kind: 'mana', amount: 2, source: 'Stretch Time' }),
			]),
		);
		await expectCostLine(card.id, 'Cost: 2 mana (Stretch Time)');
	}, 60_000);
});

/**
 * Club/Mace is 1d6+STR (1 here) and the primary die is set to 4 in the window, so the dice
 * deal 4 and the modifier 1. Heavy armor takes half the dice and no modifiers: 2. Two steps
 * lower is no armor: the full 5.
 */
describe('a Zealot split on a melee attack against Heavy armor', () => {
	const STARTING_HP = 50;
	let oathsworn: SheetActor;
	let target: SheetActor;
	let targetToken_: TokenDocument;
	let originalSceneId: string | null = null;

	beforeAll(async () => {
		originalSceneId = canvas.scene?.id ?? null;
		oathsworn = (await buildCharacter({
			name: `${TEST_PREFIX} Oathsworn`,
			className: 'Oathsworn',
			level: 5,
		})) as SheetActor;
		const mace = oathsworn.items.contents.find((item) => item.name === 'Club/Mace')!;
		await oathsworn.updateItem(mace.id, { 'system.equipped': true });

		target = (await Actor.create({
			name: `${TEST_PREFIX} Brute`,
			type: 'npc',
		})) as unknown as SheetActor;
		await target.update({
			'system.attributes.hp.max': STARTING_HP,
			'system.attributes.hp.value': STARTING_HP,
			'system.attributes.armor': 'heavy',
		});

		const scene = await createViewedTestScene(`${TEST_PREFIX} Scene`);
		await placeToken(scene, {
			name: 'fc-oathsworn',
			actor: oathsworn as unknown as Actor,
			gx: 3,
			gy: 3,
			disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY,
			actorLink: true,
		});
		targetToken_ = await placeToken(scene, {
			name: 'fc-brute',
			actor: target as unknown as Actor,
			gx: 4,
			gy: 3,
			disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE,
			actorLink: true,
		});
	}, 120_000);

	afterAll(async () => {
		await oathsworn?.sheet.close();
		await clearTargets();
		if (originalSceneId) await game.scenes.get(originalSceneId)?.view();
	});

	async function attack(blessedAim: number, condemningStrike: number) {
		await target.update({ 'system.attributes.hp.value': STARTING_HP });
		await targetToken(targetToken_);
		const mace = oathsworn.items.contents.find((item) => item.name === 'Club/Mace')!;
		const root = await useFromSheet(oathsworn, 'actions', mace.id);

		const heading = [...root.querySelectorAll('h5')].find((each) =>
			each.textContent?.startsWith('Zealot'),
		);
		expect(heading?.textContent?.trim()).toBe('Zealot (up to 2 mana)');
		for (const [pick, count] of [
			['Blessed Aim', blessedAim],
			['Condemning Strike', condemningStrike],
		] as const) {
			// The stepper names the pick with its effect: "One more: Blessed Aim: armor 1 step lower".
			const prefix = t('NIMBLE.useOptions.split.increment', { pick });
			const more = [...root.querySelectorAll<HTMLButtonElement>('button[aria-label]')].find(
				(button) => button.getAttribute('aria-label')!.startsWith(`${prefix}:`),
			);
			expect(more, `a + stepper for ${pick}`).toBeTruthy();
			for (let i = 0; i < count; i += 1) {
				more!.click();
				await settle(150);
			}
		}

		const primary = [...root.querySelectorAll<HTMLLabelElement>('label.fld')]
			.find((label) => label.textContent?.includes(t(CONFIG.NIMBLE.hitDice.setPrimaryDie)))
			?.querySelector<HTMLInputElement>('input');
		expect(primary, 'the Set Primary Die Result field').toBeTruthy();
		primary!.value = '4';
		primary!.dispatchEvent(new Event('input', { bubbles: true }));
		await settle(200);

		const totalLine = root.querySelector('.nimble-pool-spend__total')?.textContent?.trim();
		const before = messageIds();
		await pressRoll(root);
		const card = await newCard(oathsworn, before);
		return { card, totalLine };
	}

	async function applyDamage(messageId: string): Promise<number> {
		const button = () =>
			document.querySelector<HTMLButtonElement>(
				`[data-message-id="${messageId}"] .nimble-button--apply-damage`,
			);
		await waitFor(() => !!button(), `the Apply Damage button on ${messageId}`);
		const hpBefore = target.system.attributes.hp.value;
		button()!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
		await waitFor(
			() => target.system.attributes.hp.value !== hpBefore,
			'the target to take damage',
		);
		return hpBefore - target.system.attributes.hp.value;
	}

	test('with no Blessed Aim, Heavy armor takes half the dice and nothing is spent', async () => {
		const manaBefore = manaOf(oathsworn);
		const { card } = await attack(0, 0);

		expect(manaOf(oathsworn)).toBe(manaBefore);
		expect(card.system.costs ?? []).toEqual([]);
		expect(await applyDamage(card.id)).toBe(2);
	}, 60_000);

	test('with 2 Blessed Aim, the armor drops two steps and the full damage lands', async () => {
		const manaBefore = manaOf(oathsworn);
		const { card, totalLine } = await attack(2, 0);

		expect(totalLine).toBe(`2 of 2 mana. You have ${manaBefore}.`);
		expect(manaOf(oathsworn)).toBe(manaBefore - 2);
		await expectCostLine(card.id, 'Cost: 2 mana (Zealot)');
		expect(await applyDamage(card.id)).toBe(5);
	}, 60_000);

	test('a split spends one mana for each pick and records them in one cost line', async () => {
		const manaBefore = manaOf(oathsworn);
		const { card, totalLine } = await attack(1, 1);

		expect(totalLine).toBe(`2 of 2 mana. You have ${manaBefore}.`);
		expect(manaOf(oathsworn)).toBe(manaBefore - 2);
		expect
			.soft(card.system.costs)
			.toEqual([expect.objectContaining({ kind: 'mana', amount: 2, source: 'Zealot' })]);
		await expectCostLine(card.id, 'Cost: 2 mana (Zealot)');
	}, 60_000);
});

describe('Rimeblades cast with the Shadowfrost spend', () => {
	let shadowmancer: SheetActor;

	const pilferedPower = () => {
		const item = shadowmancer.items.contents.find((each) => each.name === 'Pilfered Power')!;
		const pools = item.flags[game.system.id]?.chargePools as
			| Record<string, { current: number }>
			| undefined;
		return pools?.['pilfered-power']?.current;
	};

	beforeAll(async () => {
		shadowmancer = (await buildCharacter({
			name: `${TEST_PREFIX} Shadowmancer`,
			className: 'Shadowmancer',
			level: 10,
		})) as SheetActor;
		await importPackItem(
			shadowmancer as never,
			'nimble-class-features',
			(e) => e.name === 'Shadowfrost',
		);
		if (!shadowmancer.items.contents.some((item) => item.name === 'Rimeblades')) {
			await importPackItem(shadowmancer as never, 'nimble-spells', (e) => e.name === 'Rimeblades');
		}
		await shadowmancer.update({ 'system.attributes.hp.temp': 12 });
		await settle();
	}, 120_000);

	afterAll(async () => {
		await shadowmancer?.sheet.close();
	});

	test('spends 10 temp HP in place of Pilfered Power, and the card says so', async () => {
		const rimeblades = shadowmancer.items.contents.find((item) => item.name === 'Rimeblades')!;
		const powerBefore = pilferedPower();
		const manaBefore = manaOf(shadowmancer);
		expect(powerBefore).toBeGreaterThan(0);

		const root = await useFromSheet(shadowmancer, 'spells', rimeblades.id);
		const label = t('NIMBLE.useOptions.spendEntry', { cost: '10 temp HP', name: 'Shadowfrost' });
		const spend = buttonNamed(root, label);
		expect(spend, `a "${label}" Spend button`).toBeTruthy();
		spend!.click();
		await settle(300);
		expect(spend!.getAttribute('aria-pressed')).toBe('true');

		const before = messageIds();
		await pressRoll(root);
		const card = await newCard(shadowmancer, before);

		expect(shadowmancer.system.attributes.hp.temp).toBe(2);
		expect(pilferedPower()).toBe(powerBefore);
		expect(manaOf(shadowmancer)).toBe(manaBefore);
		await expectCostLine(card.id, 'Cost: 10 temp HP (Shadowfrost)');
	}, 60_000);
});

afterAll(async () => {
	await purgeTestDocuments(TEST_PREFIX);
	if (resourceSpendingBefore !== null) {
		await setAutomationToggle(RESOURCE_SPENDING_SETTING, resourceSpendingBefore);
	}
});
