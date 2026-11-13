/**
 * Live tests for Held Changes as Timed Effects. Each action under test is a click on the real UI:
 * the sheet's use button, the roll window's roll button, the card's Apply button and the combat
 * tracker's Next Turn. The setup (actors, items, tokens, combat) uses the API.
 */

import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import {
	createViewedTestScene,
	getRuleAutomationEnabled,
	importPackItem,
	placeToken,
	purgeTestDocuments,
	setRuleAutomationEnabled,
	settle,
	targetToken,
	waitFor,
} from './liveHelpers.ts';

const TEST_PREFIX = 'V14 Held Changes';

type LiveActor = Actor & {
	id: string;
	uuid: string;
	effects: { contents: Array<{ id: string; name: string; system: { rules?: unknown[] } }> };
	sheet: {
		render(force: boolean): Promise<unknown>;
		close(): Promise<unknown>;
		element: HTMLElement;
	};
};

function hasEffect(actor: LiveActor, name: string): boolean {
	return actor.effects.contents.some((effect) => effect.name === name);
}

function visible(element: Element | null): element is HTMLElement {
	return !!element && (element as HTMLElement).offsetParent !== null;
}

function buttonByLabel(root: ParentNode, label: string | RegExp): HTMLButtonElement | null {
	return (
		[...root.querySelectorAll<HTMLButtonElement>('button[aria-label]')].find((button) => {
			const text = button.getAttribute('aria-label') ?? '';
			return typeof label === 'string' ? text === label : label.test(text);
		}) ?? null
	);
}

async function openSheet(actor: LiveActor): Promise<HTMLElement> {
	await actor.sheet.render(true);
	await waitFor(() => !!actor.sheet.element?.isConnected, `${actor.name} sheet`);
	await settle(300);
	return actor.sheet.element;
}

/** Click a sheet button by its label, trying each tab until it shows. */
async function clickSheetButton(actor: LiveActor, label: string | RegExp): Promise<void> {
	const sheet = await openSheet(actor);
	let button = buttonByLabel(sheet, label);
	for (const tab of ['Actions', 'Features', 'Spells']) {
		if (visible(button)) break;
		const tabButton =
			[...sheet.querySelectorAll<HTMLElement>('[role="tab"], nav button')].find(
				(each) => each.textContent?.trim() === tab,
			) ?? null;
		tabButton?.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
		tabButton?.click();
		await settle(300);
		button = buttonByLabel(sheet, label);
	}
	if (!button) throw new Error(`no button "${label}" on ${actor.name}`);
	button.click();
	await settle(600);
}

function rollWindow(): HTMLElement | null {
	const windows = [...document.querySelectorAll<HTMLElement>('.nimble-roll-window')];
	return windows.at(-1) ?? null;
}

function heldLines(): string[] {
	return [...(rollWindow()?.querySelectorAll<HTMLElement>('.held') ?? [])].map((line) =>
		line.innerText.replace(/\s+/g, ' ').trim(),
	);
}

async function clickRoll(): Promise<void> {
	await waitFor(() => !!rollWindow(), 'the roll window');
	const buttons = rollWindow()!.querySelectorAll<HTMLButtonElement>('.foot button');
	buttons[buttons.length - 1]!.click();
	await settle(1200);
}

async function clickCancel(): Promise<void> {
	await waitFor(() => !!rollWindow(), 'the roll window');
	rollWindow()!.querySelector<HTMLButtonElement>('.foot button')!.click();
	await settle(400);
}

/** Click the Apply button of the last card that shows `name`. */
async function clickApply(name: string): Promise<void> {
	let button: HTMLButtonElement | null = null;
	await waitFor(() => {
		const cards = [...document.querySelectorAll<HTMLElement>('#chat .chat-message')].filter(
			(card) => card.innerText.includes(name),
		);
		button = cards.at(-1)?.querySelector<HTMLButtonElement>('.nimble-apply-effect__button') ?? null;
		return !!button;
	}, `the Apply button of ${name}`);
	button!.click();
	await settle(1200);
}

async function clickNextTurn(): Promise<void> {
	const button = document.querySelector<HTMLButtonElement>(
		'button.nimble-ct__icon-button[aria-label="Next Turn"]',
	);
	if (!button) throw new Error('no Next Turn button on the combat tracker');
	button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
	await settle(1500);
}

async function closeSheets(...actors: LiveActor[]): Promise<void> {
	for (const actor of actors) await actor.sheet.close().catch(() => {});
	await settle(200);
}

describe('Held Changes as Timed Effects', () => {
	let commander: LiveActor;
	let ally: LiveActor;
	let hunter: LiveActor;
	let goblin: LiveActor;
	let tokens: Record<string, TokenDocument>;
	let combat: Combat | null = null;
	let originalAutomation: boolean;

	async function startCombat(first: LiveActor): Promise<void> {
		if (combat) await combat.delete().catch(() => {});
		await settle(600);
		for (const actor of [commander, ally, hunter, goblin]) {
			const ids = actor.effects.contents.map((effect) => effect.id);
			if (ids.length) await actor.deleteEmbeddedDocuments('ActiveEffect', ids).catch(() => {});
		}
		const scene = canvas.scene!;
		combat = (await Combat.create({ scene: scene.id, active: true } as Combat.CreateData))!;
		await combat.createEmbeddedDocuments(
			'Combatant',
			Object.values(tokens).map((token) => ({
				tokenId: token.id,
				sceneId: scene.id,
				actorId: token.actorId,
				type: token.actor!.type,
				initiative: 10,
			})) as Combatant.CreateData[],
		);
		await combat.startCombat();
		await combat.update({ turn: combat.turns.findIndex((each) => each.actorId === first.id) });
		await settle(800);
		for (const actor of [commander, ally, hunter, goblin]) {
			const ids = actor.effects.contents.map((effect) => effect.id);
			if (ids.length) await actor.deleteEmbeddedDocuments('ActiveEffect', ids).catch(() => {});
		}
		await settle(300);
	}

	beforeAll(async () => {
		await purgeTestDocuments(TEST_PREFIX);
		originalAutomation = getRuleAutomationEnabled();
		if (!originalAutomation) await setRuleAutomationEnabled(true);
		for (const each of [...game.combats]) await each.delete().catch(() => {});

		const hero = async (name: string) => {
			const actor = (await Actor.create({ name: `${TEST_PREFIX} ${name}`, type: 'character' }))!;
			await actor.update({
				'system.attributes.hp.bonus': 20,
				'system.attributes.hp.value': 20,
			} as never);
			return actor as unknown as LiveActor;
		};
		const loose = (entry: { name: string }, name: string) => entry.name === name;
		const strip = async (actor: LiveActor, packName: string, name: string) => {
			const item = await importPackItem(actor, packName, (entry) => loose(entry, name));
			await item.update({ 'system.class': '', 'system.group': '', 'system.tier': 0 } as never);
			return item;
		};

		commander = await hero('Commander');
		await strip(commander, 'nimble-spells', 'True Strike');
		await strip(commander, 'nimble-class-features', 'Advance!');
		await strip(commander, 'nimble-class-features', 'Nullify');
		const dagger = await importPackItem(commander, 'nimble-items', (entry) =>
			loose(entry, 'Dagger'),
		);
		await dagger.update({ 'system.equipped': true } as never);

		ally = await hero('Ally');
		const allyDagger = await importPackItem(ally, 'nimble-items', (entry) =>
			loose(entry, 'Dagger'),
		);
		await allyDagger.update({ 'system.equipped': true } as never);

		hunter = await hero('Hunter');
		await strip(hunter, 'nimble-class-features', "Hunter's Resolve");
		await strip(hunter, 'nimble-class-features', 'Thrill of the Hunt');
		await strip(hunter, 'nimble-class-features', "Hunter's Mark");
		const hunterDagger = await importPackItem(hunter, 'nimble-items', (entry) =>
			loose(entry, 'Dagger'),
		);
		await hunterDagger.update({ 'system.equipped': true } as never);
		await hunter.update({ 'system.attributes.hp.value': 19 } as never);

		goblin = (await Actor.create({
			name: `${TEST_PREFIX} Goblin`,
			type: 'npc',
		}))! as unknown as LiveActor;
		await goblin.update({
			'system.attributes.hp.max': 80,
			'system.attributes.hp.value': 80,
		} as never);

		const scene = await createViewedTestScene(`${TEST_PREFIX} Scene`);
		tokens = {
			commander: await placeToken(scene, {
				name: commander.name!,
				actor: commander,
				gx: 5,
				gy: 5,
				disposition: 1,
				actorLink: true,
			}),
			ally: await placeToken(scene, {
				name: ally.name!,
				actor: ally,
				gx: 5,
				gy: 7,
				disposition: 1,
				actorLink: true,
			}),
			hunter: await placeToken(scene, {
				name: hunter.name!,
				actor: hunter,
				gx: 5,
				gy: 3,
				disposition: 1,
				actorLink: true,
			}),
			goblin: await placeToken(scene, {
				name: goblin.name!,
				actor: goblin,
				gx: 6,
				gy: 5,
				disposition: -1,
				actorLink: true,
			}),
		};
	}, 120_000);

	afterAll(async () => {
		await closeSheets(commander, ally, hunter, goblin);
		if (combat) await combat.delete().catch(() => {});
		if (getRuleAutomationEnabled() !== originalAutomation) {
			await setRuleAutomationEnabled(originalAutomation);
		}
		await purgeTestDocuments(TEST_PREFIX);
	});

	test('True Strike gives the next attack of its target advantage, then goes away', async () => {
		await startCombat(commander);
		await targetToken(tokens.ally!);
		await clickSheetButton(commander, 'Cast True Strike');
		if (rollWindow()) await clickRoll();
		await clickApply('True Strike');
		await waitFor(() => hasEffect(ally, 'True Strike'), 'True Strike on the ally');
		await closeSheets(commander);

		await targetToken(tokens.goblin!);
		await clickSheetButton(ally, 'Use Dagger');
		expect(heldLines().some((line) => line.startsWith('True Strike: +1 advantage'))).toBe(true);
		await clickRoll();
		await waitFor(() => !hasEffect(ally, 'True Strike'), 'the attack to use up True Strike');
		const roll = game.messages.contents.at(-1)!.rolls[0] as { options: { rollMode?: number } };
		expect(roll.options.rollMode).toBe(1);
		await closeSheets(ally);
	}, 90_000);

	test("Advance! is used only by the Commander's melee attack, and ends with the Commander's turn", async () => {
		await startCombat(commander);
		await targetToken(tokens.goblin!);
		await clickSheetButton(commander, /^(Use|Post) Advance!/);
		if (rollWindow()) await clickRoll();
		await clickApply('Advance!');
		await waitFor(() => hasEffect(goblin, 'Advance!'), 'Advance! on the goblin');
		await closeSheets(commander);

		await clickSheetButton(ally, 'Use Dagger');
		expect(heldLines()).toEqual([]);
		await clickCancel();
		await closeSheets(ally);
		await clickSheetButton(commander, 'Use Dagger');
		expect(heldLines().some((line) => line.startsWith('Advance!: +1 advantage'))).toBe(true);
		await clickCancel();
		await closeSheets(commander);

		await clickNextTurn();
		await waitFor(() => !hasEffect(goblin, 'Advance!'), "the end of the Commander's turn");
	}, 90_000);

	test("Hunter's Resolve comes only on the Hunter's own turn with an empty pool", async () => {
		await startCombat(goblin);
		await hunter.update({ 'system.attributes.hp.value': 18 } as never);
		await settle(1200);
		expect(hasEffect(hunter, "Hunter's Resolve")).toBe(false);

		while (combat!.combatant?.actorId !== hunter.id) await clickNextTurn();
		await waitFor(
			() => hasEffect(hunter, "Hunter's Resolve"),
			"Hunter's Resolve on the Hunter's turn",
		);
		expect(
			hunter.effects.contents.filter((effect) => effect.name === "Hunter's Resolve"),
		).toHaveLength(1);

		await targetToken(tokens.goblin!);
		await clickSheetButton(hunter, 'Use Dagger');
		expect(rollWindow()!.innerText).toContain("Hunter's Mark");
		await clickCancel();
		await closeSheets(hunter);

		await clickNextTurn();
		await waitFor(() => !hasEffect(hunter, "Hunter's Resolve"), "the end of the Hunter's turn");
	}, 120_000);

	test('Nullify holds "ignore all disadvantage" for the next attack, and the attack uses it up', async () => {
		await startCombat(commander);
		await clickSheetButton(commander, 'Use Nullify');
		await settle(800);
		await waitFor(() => hasEffect(commander, 'Nullify'), 'Nullify on the Commander');
		for (const app of foundry.applications.instances.values()) {
			if ((app as { title?: string }).title === 'Demand Control') await app.close();
		}
		await targetToken(tokens.goblin!);
		await clickSheetButton(commander, 'Use Dagger');
		expect(heldLines().some((line) => line.startsWith('Nullify: ignore all disadvantage'))).toBe(
			true,
		);
		await clickRoll();
		await waitFor(() => !hasEffect(commander, 'Nullify'), 'the attack to use up Nullify');
		await closeSheets(commander);
	}, 90_000);
});
