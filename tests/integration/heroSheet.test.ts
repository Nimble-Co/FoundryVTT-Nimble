/**
 * The new character sheet (HeroSheet) through its rendered controls on live Foundry V14.
 *
 * Each action under test is a DOM event on the control a player uses: a tab, a row, the EQUIP
 * tag, the HP number, a rest button, a drop. `page.evaluate`-style calls set up documents and
 * read the results only. Outside code (the heroic action macro, a dice pool spend request)
 * reaches the sheet through `reveal()`, as in play.
 */

import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import {
	createViewedTestScene,
	getRuleAutomationEnabled,
	importPackItem,
	placeableOf,
	placeToken,
	purgeTestDocuments,
	setRuleAutomationEnabled,
	settle,
	waitFor,
} from './liveHelpers.ts';

const TEST_PREFIX = 'V14 Hero Sheet';

interface HeroSheetApp {
	rendered: boolean;
	element: HTMLElement;
	render(options: object): Promise<unknown>;
	close(): Promise<unknown>;
	setPosition(position: { width?: number; height?: number }): unknown;
	reveal(request: { tab: string; rowId?: string; step?: 'choice'; flash?: boolean }): void;
}

interface SheetEntry {
	id: string;
	cls: unknown;
	default: boolean;
	label: string;
}

interface HeroActor {
	id: string;
	uuid: string;
	name: string;
	sheet: HeroSheetApp;
	items: { get(id: string): Item | undefined; contents: Item[] };
	effects: { get(id: string): ActiveEffect | undefined; contents: ActiveEffect[] };
	system: { attributes: { hp: { value: number } } };
	createEmbeddedDocuments(type: 'Item', data: object[]): Promise<Item[]>;
	update(changes: Record<string, unknown>): Promise<unknown>;
}

const t = (key: string, data?: Record<string, string>) =>
	data ? game.i18n.format(key, data) : game.i18n.localize(key);

const characterSheets = () =>
	Object.values(
		(CONFIG.Actor as unknown as { sheetClasses: Record<string, Record<string, SheetEntry>> })
			.sheetClasses.character,
	);

const heroEntry = () =>
	characterSheets().find((entry) => t(entry.label) === t('NIMBLE.sheets.hero'))!;

const objectData = (name: string, system: Record<string, unknown> = {}) => ({
	name: `${TEST_PREFIX} ${name}`,
	type: 'object',
	system: { objectSizeType: 'slots', slotsRequired: 1, ...system },
});

const rowOf = (sheet: HTMLElement, id: string) =>
	sheet.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(id)}"]`);

const useButtonOf = (row: HTMLElement) =>
	row.querySelector<HTMLButtonElement>('button.use, button.main');

const tabButton = (sheet: HTMLElement, name: string) =>
	[...sheet.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((tab) =>
		(tab.getAttribute('aria-label') || tab.textContent || '').trim().startsWith(name),
	);

const selectedTab = (sheet: HTMLElement) => {
	const tab = sheet.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]');
	return (tab?.getAttribute('aria-label') || tab?.textContent || '').trim();
};

const buttonNamed = (root: ParentNode, name: string) =>
	[...root.querySelectorAll<HTMLButtonElement>('button')].find(
		(button) => button.getAttribute('aria-label') === name || button.textContent?.trim() === name,
	);

async function openTab(sheet: HTMLElement, key: string): Promise<void> {
	const name = t(`NIMBLE.actorSheet.hero.tabs.${key}`);
	const tab = tabButton(sheet, name);
	if (!tab) throw new Error(`no ${name} tab on the sheet`);
	tab.click();
	await waitFor(() => selectedTab(sheet).startsWith(name), `the ${name} tab to open`);
	await settle(200);
}

function dragData(data: object): DataTransfer {
	const transfer = new DataTransfer();
	transfer.setData('text/plain', JSON.stringify(data));
	return transfer;
}

function dropOn(target: Element, data: object): void {
	const dataTransfer = dragData(data);
	for (const type of ['dragenter', 'dragover', 'drop']) {
		target.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer }));
	}
}

/** Every write of `data-flash` on a row, stamped in the page, so a short flash is not missed. */
function recordFlashes(sheet: HTMLElement) {
	const flashes: { rowId: string; serial: string }[] = [];
	const observer = new MutationObserver((records) => {
		for (const record of records) {
			const row = record.target as HTMLElement;
			if (row.dataset.flash)
				flashes.push({ rowId: row.dataset.rowId ?? '', serial: row.dataset.flash });
		}
	});
	observer.observe(sheet, { subtree: true, attributes: true, attributeFilter: ['data-flash'] });
	return { flashes, stop: () => observer.disconnect() };
}

async function openHeroSheet(actor: HeroActor, width = 720): Promise<HTMLElement> {
	await actor.sheet.render({ force: true, position: { width, height: 850 } });
	await waitFor(() => actor.sheet.rendered && !!actor.sheet.element, 'the hero sheet to render');
	await settle(600);
	return actor.sheet.element;
}

describe('the new character sheet', () => {
	let hero: HeroActor;
	let plain: HeroActor;
	let backpackId: string;
	let shieldId: string;
	let noteId: string;
	let worldTorch: Item;
	let worldLantern: Item;
	let rageItem: Item;
	let taygItem: Item;
	let macro: Macro | undefined;
	let scene: Scene;
	let combat: Combat | undefined;
	let originalAutoApply: boolean;

	beforeAll(async () => {
		await purgeTestDocuments(TEST_PREFIX);
		for (const item of game.items.filter((entry) => entry.name.startsWith(TEST_PREFIX))) {
			await item.delete();
		}
		originalAutoApply = getRuleAutomationEnabled();
		if (!originalAutoApply) await setRuleAutomationEnabled(true);

		hero = (await Actor.create({
			name: `${TEST_PREFIX} Hero`,
			type: 'character',
			flags: { core: { sheetClass: heroEntry().id } },
			system: {
				abilities: { strength: { baseValue: 3 }, dexterity: { baseValue: 2 } },
				attributes: { hp: { value: 20, max: 20 } },
				details: { notes: '<p>Left the hold after the mine fell.</p>' },
			},
		} as Actor.CreateData)) as unknown as HeroActor;
		plain = (await Actor.create({
			name: `${TEST_PREFIX} Plain`,
			type: 'character',
		} as Actor.CreateData)) as unknown as HeroActor;

		// the hero with containers
		const [backpack] = await hero.createEmbeddedDocuments('Item', [
			objectData('Backpack', {
				container: { enabled: true, capacity: 10, slotCostMode: 'ignore' },
			}),
		]);
		backpackId = backpack!.id!;
		const created = await hero.createEmbeddedDocuments('Item', [
			objectData('Rope', { containerId: backpackId }),
			objectData('Shield', { objectType: 'shield', equipped: false }),
			objectData('Potion', { objectType: 'consumable', quantity: 2 }),
			{ name: `${TEST_PREFIX} Note`, type: 'feature', system: {} },
		]);
		shieldId = created.find((item) => item.name.endsWith('Shield'))!.id!;
		noteId = created.find((item) => item.name.endsWith('Note'))!.id!;

		worldTorch = (await Item.create(objectData('Torch') as Item.CreateData)) as Item;
		worldLantern = (await Item.create(objectData('Lantern') as Item.CreateData)) as Item;

		rageItem = await importPackItem(
			hero as unknown as Actor,
			'nimble-class-features',
			(entry) => entry.name === 'Rage',
		);
		taygItem = await importPackItem(hero as unknown as Actor, 'nimble-class-features', (entry) =>
			entry.name.startsWith('That all you got'),
		);
		const rules = (rageItem.toObject() as { system: { rules: Array<Record<string, unknown>> } })
			.system.rules;
		for (const rule of rules) if (rule.type === 'dicePool') rule.max = '4';
		await rageItem.update({ 'system.rules': rules } as Item.UpdateData);
		await hero.update({ 'system.attributes.hp.value': 20 });
		await settle(600);
	}, 120_000);

	afterAll(async () => {
		await hero?.sheet.close().catch(() => {});
		await plain?.sheet.close().catch(() => {});
		await macro?.delete().catch(() => {});
		await combat?.delete().catch(() => {});
		await worldTorch?.delete().catch(() => {});
		await worldLantern?.delete().catch(() => {});
		if (getRuleAutomationEnabled() !== originalAutoApply) {
			await setRuleAutomationEnabled(originalAutoApply);
		}
		await purgeTestDocuments(TEST_PREFIX);
	});

	test('the sheet selector offers it, and the old sheet stays the default', async () => {
		const entry = heroEntry();
		expect(t(entry.label)).toBe('Character sheet (Hero)');
		expect(entry.default).toBe(false);
		expect(characterSheets().find((sheet) => sheet.default)?.id).not.toBe(entry.id);
		expect(plain.sheet.constructor).not.toBe(entry.cls);
		expect(hero.sheet.constructor).toBe(entry.cls);

		await plain.sheet.render({ force: true });
		await waitFor(() => plain.sheet.rendered, 'the old sheet to render');
		await settle(600);
		const frame = plain.sheet.element;
		frame.querySelector<HTMLButtonElement>('[data-action="toggleControls"]')!.click();
		await waitFor(
			() =>
				!!document.querySelector('#context-menu [data-action="configureSheet"], #context-menu li'),
			'the window menu',
		);
		const configure = [...document.querySelectorAll<HTMLElement>('#context-menu li')].find(
			(item) => item.textContent?.trim() === t('SHEETS.ConfigureSheet'),
		);
		expect(configure, 'a Configure Sheet entry in the window menu').toBeTruthy();
		configure!.click();
		await waitFor(
			() => !!document.querySelector('.sheet-config select, #document-sheet-config select'),
			'the sheet config window',
		);
		await settle(300);
		const options = [
			...document.querySelectorAll<HTMLOptionElement>(
				'.sheet-config select option, #document-sheet-config select option',
			),
		].map((option) => option.textContent?.trim());
		expect(options).toContain('Character sheet (Hero)');

		for (const app of foundry.applications.instances.values()) {
			if ((app as { constructor: { name: string } }).constructor.name === 'DocumentSheetConfig') {
				await app.close();
			}
		}
		await plain.sheet.close();
	}, 60_000);

	test('each tab opens and shows its content', async () => {
		const sheet = await openHeroSheet(hero);
		const panels: [string, () => boolean][] = [
			['core', () => !!sheet.querySelector('[data-row-id], section, .tile, [class*="save"]')],
			['actions', () => !!rowOf(sheet, 'heroic-assess')],
			['features', () => !!rowOf(sheet, noteId)],
			['inventory', () => !!rowOf(sheet, backpackId)],
			['spells', () => true],
			[
				'effects',
				() => sheet.textContent!.includes(t('NIMBLE.actorSheet.hero.effects.allConditions')),
			],
			['bio', () => !!sheet.querySelector('prose-mirror')?.textContent?.includes('the mine fell')],
			['settings', () => sheet.textContent!.includes(t('NIMBLE.jsonExport.exportButton'))],
		];
		for (const [tab, shows] of panels) {
			await openTab(sheet, tab);
			expect(shows(), `the ${tab} tab content`).toBe(true);
		}
	}, 60_000);

	test('a click on a feature row posts it to chat', async () => {
		const sheet = await openHeroSheet(hero);
		await openTab(sheet, 'features');
		const before = new Set(game.messages.contents.map((message) => message.id));
		useButtonOf(rowOf(sheet, noteId)!)!.click();
		await waitFor(
			() => game.messages.contents.some((message) => !before.has(message.id)),
			'the feature card',
		);
	}, 30_000);

	test('the EQUIP tag equips the shield', async () => {
		const sheet = await openHeroSheet(hero);
		await openTab(sheet, 'inventory');
		const tag = rowOf(sheet, shieldId)!.querySelector<HTMLButtonElement>('button[aria-pressed]')!;
		expect(tag.getAttribute('aria-pressed')).toBe('false');
		tag.click();
		await waitFor(
			() => (hero.items.get(shieldId)!.system as { equipped?: boolean }).equipped === true,
			'the shield to be equipped',
		);
		await waitFor(
			() =>
				rowOf(sheet, shieldId)!
					.querySelector('button[aria-pressed]')
					?.getAttribute('aria-pressed') === 'true',
			'the tag to show EQUIPPED',
		);
	}, 30_000);

	test('typing in the HP number sets the HP', async () => {
		const sheet = await openHeroSheet(hero);
		const label = t('NIMBLE.actorSheet.parts.vitalPlate.current', {
			label: t('NIMBLE.actorSheet.parts.vitalPlate.hp'),
		});
		const input = sheet.querySelector<HTMLInputElement>(
			`input[aria-label="${CSS.escape(label)}"]`,
		)!;
		expect(input, 'the HP number').toBeTruthy();
		input.focus();
		input.value = '13';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		input.blur();
		await waitFor(() => hero.system.attributes.hp.value === 13, 'the HP to be 13');
		await hero.update({ 'system.attributes.hp.value': 20 });
	}, 30_000);

	test('the Field Rest button opens the field rest window', async () => {
		const sheet = await openHeroSheet(hero);
		const fieldRest = buttonNamed(sheet, t('NIMBLE.prompts.fieldRest'));
		expect(fieldRest, 'a Field Rest button').toBeTruthy();
		fieldRest!.click();
		const restWindow = () =>
			[...foundry.applications.instances.values()].find((app) =>
				String((app as { title?: string }).title ?? '').startsWith(`${hero.name}: Field Rest`),
			);
		await waitFor(() => !!restWindow()?.rendered, 'the field rest window');
		await restWindow()!.close();
	}, 30_000);

	test('a drop on the Inventory list adds the object and flashes its row', async () => {
		const sheet = await openHeroSheet(hero);
		await openTab(sheet, 'inventory');
		const record = recordFlashes(sheet);
		const before = new Set(hero.items.contents.map((item) => item.id));
		dropOn(sheet.querySelector('.list')!, { type: 'Item', uuid: worldTorch.uuid });

		await waitFor(
			() =>
				hero.items.contents.some((item) => !before.has(item.id) && item.name === worldTorch.name),
			'the torch on the hero',
		);
		const torch = hero.items.contents.find((item) => !before.has(item.id))!;
		await waitFor(() => !!rowOf(sheet, torch.id!), 'the torch row');
		await waitFor(
			() => record.flashes.some((flash) => flash.rowId === torch.id),
			'the torch row to flash',
		);
		record.stop();
		expect((torch.system as { containerId?: string }).containerId ?? '').toBe('');
	}, 30_000);

	test('a drop on a container row stores the object in it', async () => {
		const sheet = await openHeroSheet(hero);
		await openTab(sheet, 'inventory');
		const before = new Set(hero.items.contents.map((item) => item.id));
		dropOn(rowOf(sheet, backpackId)!, { type: 'Item', uuid: worldLantern.uuid });

		await waitFor(
			() =>
				hero.items.contents.some((item) => !before.has(item.id) && item.name === worldLantern.name),
			'the lantern on the hero',
		);
		const lantern = hero.items.contents.find((item) => !before.has(item.id))!;
		expect((lantern.system as { containerId?: string }).containerId).toBe(backpackId);
	}, 30_000);

	test('a drop of an object on another tab opens the Inventory at its row', async () => {
		const sheet = await openHeroSheet(hero);
		await openTab(sheet, 'features');
		const record = recordFlashes(sheet);
		const potion = hero.items.contents.find((item) => item.name.endsWith('Potion'))!;
		dropOn(sheet.querySelector('[role="tabpanel"], .body, main') ?? sheet, {
			type: 'Item',
			uuid: potion.uuid,
		});
		await waitFor(
			() => selectedTab(sheet).startsWith(t('NIMBLE.actorSheet.hero.tabs.inventory')),
			'the Inventory tab',
		);
		await waitFor(
			() => record.flashes.some((flash) => flash.rowId === potion.id),
			'the potion row to flash',
		);
		record.stop();
	}, 30_000);

	test('a second reveal of the same row flashes it again', async () => {
		const sheet = await openHeroSheet(hero);
		const record = recordFlashes(sheet);
		const serials = () =>
			new Set(record.flashes.filter((flash) => flash.rowId === backpackId).map((f) => f.serial));
		hero.sheet.reveal({ tab: 'inventory', rowId: backpackId, flash: true });
		await waitFor(() => serials().size === 1, 'the first flash');
		hero.sheet.reveal({ tab: 'inventory', rowId: backpackId, flash: true });
		await waitFor(() => serials().size === 2, 'the second flash');
		record.stop();
	}, 30_000);

	test('in edit mode the trash button asks, then deletes the object', async () => {
		const sheet = await openHeroSheet(hero);
		await openTab(sheet, 'inventory');
		buttonNamed(sheet, t('NIMBLE.actorSheet.hero.rail.edit'))!.click();
		await settle(300);
		const potion = hero.items.contents.find((item) => item.name.endsWith('Potion'))!;
		const trash = buttonNamed(
			rowOf(sheet, potion.id!)!,
			t('NIMBLE.actorSheet.shared.deleteName', { name: potion.name }),
		);
		expect(trash, 'a trash button on the row').toBeTruthy();
		trash!.click();
		await settle(200);
		expect(hero.items.get(potion.id!), 'one click does not delete').toBeTruthy();
		buttonNamed(rowOf(sheet, potion.id!)!, t('NIMBLE.actorSheet.shared.delete'))!.click();
		await waitFor(() => !hero.items.get(potion.id!), 'the potion to leave the sheet');
		buttonNamed(sheet, t('NIMBLE.actorSheet.hero.rail.edit'))!.click();
		await settle(300);
	}, 30_000);

	test('a finger drags a row only in edit mode', async () => {
		const sheet = await openHeroSheet(hero);
		await openTab(sheet, 'inventory');
		const tryDrag = (pointerType: string) => {
			const row = rowOf(sheet, shieldId)!;
			row.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType }));
			const start = new DragEvent('dragstart', {
				bubbles: true,
				cancelable: true,
				dataTransfer: new DataTransfer(),
			});
			row.dispatchEvent(start);
			return !start.defaultPrevented;
		};
		expect(tryDrag('mouse'), 'a mouse drags in play').toBe(true);
		expect(tryDrag('touch'), 'a finger does not drag in play').toBe(false);

		buttonNamed(sheet, t('NIMBLE.actorSheet.hero.rail.edit'))!.click();
		await settle(300);
		expect(tryDrag('touch'), 'a finger drags in edit mode').toBe(true);
		buttonNamed(sheet, t('NIMBLE.actorSheet.hero.rail.edit'))!.click();
		await settle(300);
	}, 30_000);

	test('the window menu configures the sheet, and the frame closes it', async () => {
		const sheet = await openHeroSheet(hero);
		sheet.querySelector<HTMLButtonElement>('[data-action="toggleControls"]')!.click();
		await waitFor(() => !!document.querySelector('#context-menu li'), 'the window menu');
		const configure = [...document.querySelectorAll<HTMLElement>('#context-menu li')].find(
			(item) => item.textContent?.trim() === t('SHEETS.ConfigureSheet'),
		);
		configure!.click();
		await waitFor(
			() => !!document.querySelector('.sheet-config select, #document-sheet-config select'),
			'the sheet config window',
		);
		await settle(300);
		const select = document.querySelector<HTMLSelectElement>(
			'.sheet-config select, #document-sheet-config select',
		)!;
		expect(select.selectedOptions[0]?.textContent?.trim()).toBe('Character sheet (Hero)');
		for (const app of foundry.applications.instances.values()) {
			if ((app as { constructor: { name: string } }).constructor.name === 'DocumentSheetConfig') {
				await app.close();
			}
		}

		sheet.querySelector<HTMLButtonElement>('[data-action="close"]')!.click();
		await waitFor(() => !hero.sheet.rendered && !sheet.isConnected, 'the sheet to close');
		const again = await openHeroSheet(hero);
		expect(rowOf(again, backpackId) ?? again.querySelector('[role="tab"]')).toBeTruthy();
	}, 60_000);

	test('after a tab click, Escape closes the sheet', async () => {
		const sheet = await openHeroSheet(hero);
		const tab = tabButton(sheet, t('NIMBLE.actorSheet.hero.tabs.bio'))!;
		tab.focus();
		tab.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
		await waitFor(
			() => selectedTab(sheet).startsWith(t('NIMBLE.actorSheet.hero.tabs.bio')),
			'the Bio tab',
		);
		expect(document.activeElement).not.toBe(tab);
		for (const type of ['keydown', 'keyup']) {
			window.dispatchEvent(
				new KeyboardEvent(type, { key: 'Escape', code: 'Escape', bubbles: true }),
			);
		}
		await waitFor(() => !hero.sheet.rendered, 'Escape to close the sheet');
	}, 30_000);

	test('a condition from the grid shows on you, and Remove takes it off after a question', async () => {
		const sheet = await openHeroSheet(hero);
		await openTab(sheet, 'effects');
		const grid = sheet.querySelector<HTMLElement>(
			`[role="group"][aria-label="${CSS.escape(t('NIMBLE.actorSheet.hero.effects.allConditions'))}"]`,
		)!;
		const toggle = grid.querySelector<HTMLButtonElement>('button[aria-pressed="false"]')!;
		const name = toggle.textContent!.trim();
		toggle.click();
		await waitFor(
			() => grid.querySelector(`button[aria-pressed="true"]`)?.textContent?.trim() === name,
			'the grid to show the condition on',
		);
		const conditionRow = () =>
			[...sheet.querySelectorAll<HTMLElement>('[data-row-id^="condition-"]')].find((row) =>
				row.textContent?.includes(name),
			);
		await waitFor(() => !!conditionRow(), 'the condition under Conditions on you');
		const statusCount = () => hero.effects.contents.filter((e) => e.statuses.size > 0).length;
		const before = statusCount();

		useButtonOf(conditionRow()!)!.click();
		await settle(200);
		expect(statusCount(), 'one click does not remove').toBe(before);
		buttonNamed(conditionRow()!, t('NIMBLE.actorSheet.hero.effects.remove'))!.click();
		await waitFor(() => !conditionRow(), 'the condition to come off');
	}, 30_000);

	test('a timed effect shows under Active effects, and Remove deletes it', async () => {
		const [effect] = await (
			hero as unknown as {
				createEmbeddedDocuments(type: 'ActiveEffect', data: object[]): Promise<ActiveEffect[]>;
			}
		).createEmbeddedDocuments('ActiveEffect', [
			{ name: `${TEST_PREFIX} Blessing`, duration: { rounds: 3 } },
		]);
		const sheet = await openHeroSheet(hero);
		await openTab(sheet, 'effects');
		const row = () => rowOf(sheet, `effect-${effect!.id}`);
		await waitFor(() => !!row(), 'the effect row');
		useButtonOf(row()!)!.click();
		await settle(200);
		buttonNamed(row()!, t('NIMBLE.actorSheet.hero.effects.remove'))!.click();
		await waitFor(() => !hero.effects.get(effect!.id!), 'the effect to be deleted');
		await waitFor(() => !row(), 'the effect row to go');
	}, 30_000);

	test('the roll button of a dice pool adds a die, and the meter shows it', async () => {
		const sheet = await openHeroSheet(hero);
		const fury = () =>
			Object.values(
				(foundry.utils.getProperty(
					hero.items.get(rageItem.id!)!,
					`flags.${game.system.id}.dicePools`,
				) ?? {}) as Record<string, { identifier: string; faces: number[]; label: string }>,
			).find((pool) => pool.identifier === 'fury')!;
		const before = fury().faces.length;
		const roll = buttonNamed(
			sheet,
			t('NIMBLE.actorSheet.parts.dicePool.addLabel', { label: fury().label }),
		);
		expect(roll, 'a roll button on the Fury meter').toBeTruthy();
		roll!.click();
		await waitFor(() => fury().faces.length === before + 1, 'a die in the pool');
		const dieLabel = t('NIMBLE.actorSheet.hero.meter.dieLabel', {
			label: fury().label,
			number: String(fury().faces.length),
			face: String(fury().faces.at(-1)),
		});
		await waitFor(
			() => !!sheet.querySelector(`[aria-label="${CSS.escape(dieLabel)}"]`),
			`the meter to show ${dieLabel}`,
		);
	}, 30_000);

	test('narrow, the rail becomes a header; wide, it is a rail again', async () => {
		const sheet = await openHeroSheet(hero);
		expect(sheet.querySelector('aside.rail')).toBeTruthy();
		hero.sheet.setPosition({ width: 390 });
		await waitFor(() => !!sheet.querySelector('header.header'), 'the narrow header');
		expect(sheet.querySelector('aside.rail')).toBeNull();
		hero.sheet.setPosition({ width: 720 });
		await waitFor(() => !!sheet.querySelector('aside.rail'), 'the wide rail');
	}, 30_000);

	test('the heroic action macro opens the Assess choice on Actions', async () => {
		await hero.sheet.close();
		await settle(300);
		scene = await createViewedTestScene(`${TEST_PREFIX} Scene`);
		const token = await placeToken(scene, {
			name: hero.name,
			actor: hero as unknown as Actor,
			gx: 3,
			gy: 3,
			disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY,
			actorLink: true,
		});
		placeableOf(token).control({ releaseOthers: true });
		macro = (await Macro.create({
			name: `${TEST_PREFIX} Assess`,
			type: 'script',
			command: 'game.nimble.macros.activateHeroicActionMacro("assess", "action")',
		} as Macro.CreateData))!;
		await macro.execute();

		await waitFor(() => hero.sheet.rendered, 'the hero sheet to open');
		const sheet = hero.sheet.element;
		await waitFor(
			() => selectedTab(sheet).startsWith(t('NIMBLE.actorSheet.hero.tabs.actions')),
			'the Actions tab',
		);
		await waitFor(
			() => useButtonOf(rowOf(sheet, 'heroic-assess')!)?.getAttribute('aria-expanded') === 'true',
			'the Assess choice step',
		);
	}, 60_000);

	test('in a combat the rail shows the turn, and it goes when the combat ends', async () => {
		const sheet = await openHeroSheet(hero);
		const tokenId = canvas.tokens!.placeables.find((token) => token.actor?.id === hero.id)!.id;
		combat = (await Combat.create({ active: true, scene: scene.id } as Combat.CreateData))!;
		await combat.createEmbeddedDocuments('Combatant', [
			{ actorId: hero.id, tokenId, sceneId: scene.id, type: 'character' },
		] as Combatant.CreateData[]);
		await combat.startCombat();
		const endTurn = () => buttonNamed(sheet, t('NIMBLE.ui.heroicActions.endTurn'));
		await waitFor(() => !!endTurn(), 'End Turn on the rail');
		await combat.delete();
		combat = undefined;
		await waitFor(() => !endTurn(), 'the turn to leave the rail');
	}, 60_000);

	test('the sheet of an unlinked token opens for the token actor', async () => {
		const token = await placeToken(scene, {
			name: `${TEST_PREFIX} Copy`,
			actor: hero as unknown as Actor,
			gx: 6,
			gy: 3,
			disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY,
		});
		const copy = token.actor as unknown as HeroActor;
		await copy.sheet.render({ force: true });
		await waitFor(() => copy.sheet.rendered, 'the token sheet to render');
		await settle(600);
		expect(copy.sheet.constructor).toBe(heroEntry().cls);
		expect(copy.sheet.element.querySelector('[role="tab"]')).toBeTruthy();
		await copy.sheet.close();
	}, 30_000);

	test('a dice pool spend request opens the choice step of its item', async () => {
		await hero.sheet.close();
		await settle(300);
		const pools = foundry.utils.getProperty(
			hero.items.get(rageItem.id!)!,
			`flags.${game.system.id}.dicePools`,
		) as Record<string, { identifier: string }>;
		const [key] = Object.entries(pools).find(([, pool]) => pool.identifier === 'fury')!;
		await hero.items
			.get(rageItem.id!)!
			.update({ [`flags.${game.system.id}.dicePools.${key}.faces`]: [3] } as Item.UpdateData);
		await settle(400);

		await (taygItem as unknown as { activate(options: object): Promise<unknown> }).activate({
			fastForward: true,
		});
		await waitFor(() => hero.sheet.rendered, 'the hero sheet to open');
		const sheet = hero.sheet.element;
		await waitFor(
			() => selectedTab(sheet).startsWith(t('NIMBLE.actorSheet.hero.tabs.actions')),
			'the Actions tab',
		);
		const pickDice = t('NIMBLE.actorSheet.hero.actions.pickDice');
		await waitFor(
			() => !!rowOf(sheet, taygItem.id!)?.textContent?.includes(pickDice),
			'the dice step of That all you got?!',
		);
	}, 60_000);
});
