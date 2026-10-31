/**
 * The new NPC sheet (MonsterSheet) through its rendered controls on live Foundry V14.
 *
 * Each action under test is a DOM event on the control a GM uses: a tab, a card, a save tile,
 * the HP number, the Edit switch, an outline, a select, a drag, a drop. `page.evaluate`-style
 * calls set up documents and read the results only.
 */

import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import {
	createViewedTestScene,
	placeToken,
	purgeTestDocuments,
	settle,
	waitFor,
} from './liveHelpers.ts';

const TEST_PREFIX = 'V14 Monster Sheet';

interface MonsterSheetApp {
	rendered: boolean;
	element: HTMLElement;
	position: { width: number };
	render(options: object): Promise<unknown>;
	close(): Promise<unknown>;
	setPosition(position: { width?: number; height?: number }): unknown;
}

interface SheetEntry {
	id: string;
	cls: unknown;
	default: boolean;
	label: string;
}

interface MonsterActor {
	id: string;
	name: string;
	type: string;
	sheet: MonsterSheetApp;
	items: { get(id: string): Item | undefined; contents: Item[] };
	system: {
		attributes: { hp: { value: number; max: number }; armor: string };
		details: { level: string };
	};
	createEmbeddedDocuments(type: 'Item', data: object[]): Promise<Item[]>;
	update(changes: Record<string, unknown>): Promise<unknown>;
}

const t = (key: string, data?: Record<string, string>) =>
	data ? game.i18n.format(key, data) : game.i18n.localize(key);

const sheetsOf = (type: string) =>
	Object.values(
		(CONFIG.Actor as unknown as { sheetClasses: Record<string, Record<string, SheetEntry>> })
			.sheetClasses[type] ?? {},
	);

const monsterEntry = (type = 'npc') =>
	sheetsOf(type).find((entry) => t(entry.label) === t('NIMBLE.sheets.monster'))!;

const ability = (name: string, subtype: string, sort: number, description = '') => ({
	name: `${TEST_PREFIX} ${name}`,
	type: 'monsterFeature',
	sort,
	system: { subtype, description },
});

const rowOf = (sheet: HTMLElement, id: string) =>
	sheet.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(id)}"]`);

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

const inputNamed = (root: ParentNode, name: string) =>
	root.querySelector<HTMLInputElement>(`input[aria-label="${CSS.escape(name)}"]`);

const windowTitled = (title: string) =>
	[...foundry.applications.instances.values()].find(
		(app) => (app as { title?: string }).title === title,
	) as { rendered: boolean; element: HTMLElement; close(): Promise<unknown> } | undefined;

/** Types a number or a text into a field as a user does: focus, input, then leave the field. */
function typeInto(input: HTMLInputElement, value: string): void {
	input.focus();
	input.value = value;
	input.dispatchEvent(new Event('input', { bubbles: true }));
	input.dispatchEvent(new Event('change', { bubbles: true }));
	input.blur();
}

async function openTab(sheet: HTMLElement, key: string): Promise<void> {
	const name = t(`NIMBLE.actorSheet.monster.tabs.${key}`);
	const tab = tabButton(sheet, name);
	if (!tab) throw new Error(`no ${name} tab on the sheet`);
	tab.click();
	await waitFor(() => selectedTab(sheet).startsWith(name), `the ${name} tab to open`);
	await settle(200);
}

async function openMonsterSheet(actor: MonsterActor, width = 660): Promise<HTMLElement> {
	await actor.sheet.render({ force: true, position: { width, height: 650 } });
	await waitFor(() => actor.sheet.rendered && !!actor.sheet.element, 'the NPC sheet to render');
	await settle(600);
	return actor.sheet.element;
}

async function setEditing(sheet: HTMLElement, on: boolean): Promise<void> {
	const toggle = sheet.querySelector<HTMLButtonElement>('button[aria-pressed].edit');
	if (!toggle) throw new Error('no Edit switch on the sheet');
	if ((toggle.getAttribute('aria-pressed') === 'true') !== on) toggle.click();
	await waitFor(
		() =>
			sheet.querySelector('button[aria-pressed].edit')?.getAttribute('aria-pressed') === String(on),
		`edit mode ${on ? 'on' : 'off'}`,
	);
	await settle(200);
}

function dragEvent(type: string, dataTransfer: DataTransfer, clientY?: number): DragEvent {
	return new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer, clientY });
}

async function closeWindowsTitled(title: string): Promise<void> {
	for (const app of foundry.applications.instances.values()) {
		if ((app as { title?: string }).title === title) await app.close();
	}
}

describe('the new NPC sheet', () => {
	let goblin: MonsterActor;
	let ogre: MonsterActor;
	let kobold: MonsterActor;
	let plain: MonsterActor;
	let tauntId: string;
	let stabId: string;
	let shootId: string;
	let tacticsId: string;
	let biteId: string;
	let worldClaw: Item;
	let scene: Scene;
	let narrowBefore: boolean;

	beforeAll(async () => {
		await purgeTestDocuments(TEST_PREFIX);
		for (const item of game.items.filter((entry) => entry.name.startsWith(TEST_PREFIX))) {
			await item.delete();
		}
		narrowBefore = Boolean(
			game.settings.get('nimble' as 'core', 'openNpcSheetsNarrow' as 'rollMode'),
		);
		if (narrowBefore) {
			await game.settings.set(
				'nimble' as 'core',
				'openNpcSheetsNarrow' as 'rollMode',
				false as never,
			);
		}

		const create = async (name: string, type: string, system: object = {}) =>
			(await Actor.create({
				name: `${TEST_PREFIX} ${name}`,
				type,
				flags: { core: { sheetClass: monsterEntry(type).id } },
				system,
			} as Actor.CreateData)) as unknown as MonsterActor;
		goblin = await create('Goblin', 'npc', {
			attributes: { hp: { value: 15, max: 15 }, armor: 'none' },
			description: '<p>Lives in the old mine.</p>',
		});
		ogre = await create('Ogre', 'soloMonster', { attributes: { hp: { value: 75, max: 75 } } });
		kobold = await create('Kobold', 'minion');
		plain = (await Actor.create({
			name: `${TEST_PREFIX} Plain`,
			type: 'npc',
		} as Actor.CreateData)) as unknown as MonsterActor;

		const created = await goblin.createEmbeddedDocuments('Item', [
			ability('Taunt', 'feature', 0, '<p>Haha, missed me!</p>'),
			ability('Stab', 'action', 100000, '<p>1d6+2.</p>'),
			ability('Shoot', 'action', 200000, '<p>1d6+2, Range 8.</p>'),
			ability('Tactics', 'feature', 300000),
			{
				...ability('Bite', 'action', 400000, '<p>1d6 piercing.</p>'),
				system: {
					subtype: 'action',
					description: '<p>1d6 piercing.</p>',
					activation: {
						targets: { attackType: 'reach', distance: 1, count: 1 },
						effects: [
							{
								id: 'bite',
								type: 'damage',
								formula: '1d6',
								damageType: 'piercing',
								canCrit: true,
								canMiss: true,
								parentNode: null,
								parentContext: null,
							},
						],
					},
				},
			},
		]);
		const idOf = (name: string) => created.find((item) => item.name.endsWith(name))!.id!;
		tauntId = idOf('Taunt');
		stabId = idOf('Stab');
		shootId = idOf('Shoot');
		tacticsId = idOf('Tactics');
		biteId = idOf('Bite');

		worldClaw = (await Item.create(
			ability('Claw', 'action', 0, '<p>2 damage.</p>') as Item.CreateData,
		)) as Item;
		await settle(600);
	}, 120_000);

	afterAll(async () => {
		for (const actor of [goblin, ogre, kobold, plain]) await actor?.sheet.close().catch(() => {});
		await worldClaw?.delete().catch(() => {});
		await game.settings.set(
			'nimble' as 'core',
			'openNpcSheetsNarrow' as 'rollMode',
			narrowBefore as never,
		);
		await purgeTestDocuments(TEST_PREFIX);
	});

	test('the sheet selector offers it for NPCs, solo monsters and minions, and the old sheet stays the default', async () => {
		for (const type of ['npc', 'soloMonster', 'minion']) {
			const entry = monsterEntry(type);
			expect(entry, `the NPC sheet (Monster) for ${type}`).toBeTruthy();
			expect(t(entry.label)).toBe('NPC sheet (Monster)');
			expect(entry.default).toBe(false);
			expect(sheetsOf(type).find((sheet) => sheet.default)?.id).not.toBe(entry.id);
		}
		expect(plain.sheet.constructor).not.toBe(monsterEntry().cls);
		expect(goblin.sheet.constructor).toBe(monsterEntry().cls);
		expect(ogre.sheet.constructor).toBe(monsterEntry('soloMonster').cls);
		expect(kobold.sheet.constructor).toBe(monsterEntry('minion').cls);
	}, 30_000);

	test('each tab opens and shows its content', async () => {
		const sheet = await openMonsterSheet(goblin);
		const panels: [string, () => boolean][] = [
			['abilities', () => !!rowOf(sheet, stabId)],
			[
				'effects',
				() => sheet.textContent!.includes(t('NIMBLE.actorSheet.shared.effects.allConditions')),
			],
			['notes', () => !!sheet.querySelector('prose-mirror')?.textContent?.includes('old mine')],
			[
				'settings',
				() => sheet.textContent!.includes(t('NIMBLE.actorSheet.monster.settings.groups.monster')),
			],
		];
		for (const [tab, shows] of panels) {
			await openTab(sheet, tab);
			expect(shows(), `the ${tab} tab content`).toBe(true);
		}
		await openTab(sheet, 'abilities');
	}, 60_000);

	test('a click on the name of an ability posts it to chat', async () => {
		const sheet = await openMonsterSheet(goblin);
		const before = new Set(game.messages.contents.map((message) => message.id));
		buttonNamed(rowOf(sheet, tauntId)!, `${TEST_PREFIX} Taunt`)!.click();
		await waitFor(
			() => game.messages.contents.some((message) => !before.has(message.id)),
			'the ability card',
		);
	}, 30_000);

	test('a click on the name of an attack opens the roll window, and Roll posts the attack', async () => {
		const sheet = await openMonsterSheet(goblin);
		const before = new Set(game.messages.contents.map((message) => message.id));
		buttonNamed(rowOf(sheet, biteId)!, `${TEST_PREFIX} Bite`)!.click();
		const title = `Activate ${TEST_PREFIX} Bite`;
		await waitFor(
			() => !!windowTitled(title)?.element?.isConnected,
			'the roll window of the attack',
		);
		windowTitled(title)!.element.querySelector<HTMLButtonElement>('.foot .btn.primary')!.click();
		await waitFor(
			() =>
				game.messages.contents.some(
					(message) => !before.has(message.id) && (message.rolls?.length ?? 0) > 0,
				),
			'the attack card with its roll',
		);
	}, 30_000);

	test('a click on a save tile rolls the save', async () => {
		const sheet = await openMonsterSheet(goblin);
		const before = new Set(game.messages.contents.map((message) => message.id));
		const tile = [...sheet.querySelectorAll<HTMLButtonElement>('aside.rail button')].find(
			(button) => button.textContent?.includes(t('NIMBLE.savingThrowAbbreviations.dexterity')),
		);
		expect(tile, 'a DEX save tile').toBeTruthy();
		tile!.click();
		const title = `${goblin.name}: Configure ${CONFIG.NIMBLE.savingThrows.dexterity} Save`;
		await waitFor(() => !!windowTitled(title)?.rendered, 'the roll window of the save');
		windowTitled(title)!.element.querySelector<HTMLButtonElement>('.foot .btn.primary')!.click();
		await waitFor(
			() => game.messages.contents.some((message) => !before.has(message.id)),
			'the save card',
		);
	}, 30_000);

	test('typing in the HP number sets the HP', async () => {
		const sheet = await openMonsterSheet(goblin);
		const label = t('NIMBLE.actorSheet.parts.vitalPlate.current', {
			label: t('NIMBLE.actorSheet.parts.vitalPlate.hp'),
		});
		typeInto(inputNamed(sheet, label)!, '9');
		await waitFor(() => goblin.system.attributes.hp.value === 9, 'the HP to be 9');
		await goblin.update({ 'system.attributes.hp.value': 15 });
	}, 30_000);

	test('in edit mode you type the name and the max HP, and select the armor', async () => {
		const sheet = await openMonsterSheet(goblin);
		await setEditing(sheet, true);

		typeInto(
			inputNamed(sheet, t('NIMBLE.actorSheet.monster.rail.name'))!,
			`${TEST_PREFIX} Goblin Boss`,
		);
		await waitFor(() => goblin.name === `${TEST_PREFIX} Goblin Boss`, 'the new name');

		const maxLabel = t('NIMBLE.actorSheet.parts.vitalPlate.maximum', {
			label: t('NIMBLE.actorSheet.parts.vitalPlate.hp'),
		});
		typeInto(inputNamed(sheet, maxLabel)!, '30');
		await waitFor(() => goblin.system.attributes.hp.max === 30, 'the max HP to be 30');

		const armor = sheet.querySelector<HTMLSelectElement>(
			`select[aria-label="${CSS.escape(t('NIMBLE.actorSheet.monster.rail.armor'))}"], label.armor select`,
		)!;
		armor.value = 'heavy';
		armor.dispatchEvent(new Event('change', { bubbles: true }));
		await waitFor(() => goblin.system.attributes.armor === 'heavy', 'heavy armor');

		await setEditing(sheet, false);
		expect(inputNamed(sheet, t('NIMBLE.actorSheet.monster.rail.name'))).toBeNull();
		await goblin.update({
			name: `${TEST_PREFIX} Goblin`,
			'system.attributes.hp.max': 15,
			'system.attributes.armor': 'none',
		});
	}, 60_000);

	test('each outline opens its window, and a level typed in the monster window saves', async () => {
		const sheet = await openMonsterSheet(goblin);
		await setEditing(sheet, true);
		const outlines: [string, string][] = [
			[t('NIMBLE.prompts.configureSavingThrows'), `${goblin.name}: Configure Saves`],
			[t('NIMBLE.prompts.configureMovement'), `${goblin.name}: Configure Movement Speeds`],
			[t('NIMBLE.npcSheet.editDamageDefenses'), `${goblin.name}: Configuration`],
			[t('NIMBLE.actorSheet.monster.rail.metaLabel'), `${goblin.name}: Configuration`],
		];
		for (const [label, title] of outlines) {
			const outline = buttonNamed(sheet, label);
			expect(outline, `the outline ${label}`).toBeTruthy();
			outline!.click();
			await waitFor(() => !!windowTitled(title)?.rendered, `the window ${title}`);
			if (label === t('NIMBLE.actorSheet.monster.rail.metaLabel')) {
				const level =
					windowTitled(title)!.element.querySelector<HTMLInputElement>('input[type="text"]')!;
				typeInto(level, '3');
				await waitFor(() => String(goblin.system.details.level) === '3', 'level 3');
			}
			await closeWindowsTitled(title);
			await settle(200);
		}
		await setEditing(sheet, false);
	}, 60_000);

	test('in edit mode Create Feature adds an ability, and the trash asks, then deletes it', async () => {
		const sheet = await openMonsterSheet(goblin);
		await setEditing(sheet, true);
		const before = new Set(goblin.items.contents.map((item) => item.id));
		buttonNamed(sheet, t('NIMBLE.npcSheet.createFeature'))!.click();
		await waitFor(
			() => goblin.items.contents.some((item) => !before.has(item.id)),
			'the new feature',
		);
		const created = goblin.items.contents.find((item) => !before.has(item.id))!;
		expect(created.name).toBe(t('NIMBLE.actorSheet.monster.abilities.newFeature'));
		await waitFor(() => !!rowOf(sheet, created.id!), 'the new feature on the tab');

		const trash = buttonNamed(
			rowOf(sheet, created.id!)!,
			t('NIMBLE.actorSheet.shared.deleteName', { name: created.name }),
		);
		expect(trash, 'a trash button on the heading line').toBeTruthy();
		trash!.click();
		await settle(200);
		expect(goblin.items.get(created.id!), 'one click does not delete').toBeTruthy();
		buttonNamed(
			rowOf(sheet, created.id!)!.parentElement!,
			t('NIMBLE.actorSheet.shared.delete'),
		)!.click();
		await waitFor(() => !goblin.items.get(created.id!), 'the feature to leave the sheet');

		expect(
			buttonNamed(
				rowOf(sheet, tacticsId)!,
				t('NIMBLE.prompts.configureItem', { name: `${TEST_PREFIX} Tactics` }),
			),
			'a pen on the heading line',
		).toBeTruthy();
		await setEditing(sheet, false);
	}, 60_000);

	test('a drag of an ability onto another reorders the group once', async () => {
		const sheet = await openMonsterSheet(goblin);
		const source = rowOf(sheet, shootId)!;
		const target = rowOf(sheet, stabId)!;
		const transfer = new DataTransfer();
		const sheetDrops: Event[] = [];
		const count = (event: Event) => sheetDrops.push(event);
		sheet.addEventListener('drop', count);

		source.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' }));
		source.dispatchEvent(dragEvent('dragstart', transfer));
		const box = target.getBoundingClientRect();
		target.dispatchEvent(dragEvent('dragover', transfer, box.top + 2));
		target.dispatchEvent(dragEvent('drop', transfer, box.top + 2));
		source.dispatchEvent(dragEvent('dragend', transfer));
		sheet.removeEventListener('drop', count);

		const sortOf = (id: string) => (goblin.items.get(id) as unknown as { sort: number }).sort;
		await waitFor(() => sortOf(shootId) < sortOf(stabId), 'Shoot above Stab');
		expect(sheetDrops, 'the sheet does not get the row drop').toHaveLength(0);
		const order = [...sheet.querySelectorAll<HTMLElement>('[data-row-id]')].map(
			(row) => row.dataset.rowId,
		);
		expect(order.indexOf(shootId)).toBeLessThan(order.indexOf(stabId));
	}, 30_000);

	test('a drop of an ability from the sidebar adds it and flashes its card', async () => {
		const sheet = await openMonsterSheet(goblin);
		const before = new Set(goblin.items.contents.map((item) => item.id));
		const flashes: string[] = [];
		const observer = new MutationObserver((records) => {
			for (const record of records) {
				const row = record.target as HTMLElement;
				if (row.dataset.flash) flashes.push(row.dataset.rowId ?? '');
			}
		});
		observer.observe(sheet, { subtree: true, attributes: true, attributeFilter: ['data-flash'] });

		const transfer = new DataTransfer();
		transfer.setData('text/plain', JSON.stringify({ type: 'Item', uuid: worldClaw.uuid }));
		const body = sheet.querySelector<HTMLElement>('main .body')!;
		for (const type of ['dragenter', 'dragover', 'drop'])
			body.dispatchEvent(dragEvent(type, transfer));

		await waitFor(
			() => goblin.items.contents.some((item) => !before.has(item.id)),
			'the dropped ability',
		);
		const claw = goblin.items.contents.find((item) => !before.has(item.id))!;
		await waitFor(() => flashes.includes(claw.id!), 'the flash of the new card');
		observer.disconnect();
		expect(goblin.items.contents.filter((item) => !before.has(item.id))).toHaveLength(1);
	}, 30_000);

	test('narrow, the rail becomes a header and a strip of tabs; wide, it is a rail again', async () => {
		const sheet = await openMonsterSheet(goblin);
		expect(sheet.querySelector('header.header')).toBeNull();
		goblin.sheet.setPosition({ width: 390 });
		await waitFor(() => !!sheet.querySelector('header.header'), 'the narrow header');
		expect(sheet.querySelector('nav.strip [role="tab"]')).toBeTruthy();
		goblin.sheet.setPosition({ width: 660 });
		await waitFor(() => !sheet.querySelector('header.header'), 'the wide rail');
	}, 30_000);

	test('with "Open NPC sheets narrow" on, a new sheet opens 390 px wide in the narrow form', async () => {
		await ogre.sheet.close();
		await settle(300);
		await game.settings.set('nimble' as 'core', 'openNpcSheetsNarrow' as 'rollMode', true as never);
		const sheetClass = monsterEntry('soloMonster').cls as new (options: object) => MonsterSheetApp;
		const app = new sheetClass({ document: ogre });
		try {
			await app.render({ force: true });
			await waitFor(() => app.rendered, 'the narrow sheet to render');
			await settle(600);
			expect(app.position.width).toBe(390);
			expect(app.element.querySelector('header.header')).toBeTruthy();
			app.setPosition({ width: 660 });
			await waitFor(() => !app.element.querySelector('header.header'), 'the wide form');
		} finally {
			await app.close();
			await game.settings.set(
				'nimble' as 'core',
				'openNpcSheetsNarrow' as 'rollMode',
				false as never,
			);
		}
	}, 30_000);

	test('a minion has the minion rules in place of the HP', async () => {
		const sheet = await openMonsterSheet(kobold);
		expect(sheet.textContent).toContain(t('NIMBLE.actorSheet.monster.rail.minion.noHp'));
		const label = t('NIMBLE.actorSheet.parts.vitalPlate.current', {
			label: t('NIMBLE.actorSheet.parts.vitalPlate.hp'),
		});
		expect(inputNamed(sheet, label)).toBeNull();
		await kobold.sheet.close();
	}, 30_000);

	test('the window menu configures the sheet, and the frame closes it', async () => {
		const sheet = await openMonsterSheet(goblin);
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
		expect(select.selectedOptions[0]?.textContent?.trim()).toBe('NPC sheet (Monster)');
		for (const app of foundry.applications.instances.values()) {
			if ((app as { constructor: { name: string } }).constructor.name === 'DocumentSheetConfig') {
				await app.close();
			}
		}
		sheet.querySelector<HTMLButtonElement>('[data-action="close"]')!.click();
		await waitFor(() => !goblin.sheet.rendered && !sheet.isConnected, 'the sheet to close');
	}, 60_000);

	test('the sheet of an unlinked token opens for the token actor', async () => {
		scene = await createViewedTestScene(`${TEST_PREFIX} Scene`);
		const token = await placeToken(scene, {
			name: `${TEST_PREFIX} Copy`,
			actor: goblin as unknown as Actor,
			gx: 4,
			gy: 4,
			disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE,
		});
		const copy = token.actor as unknown as MonsterActor;
		await copy.sheet.render({ force: true });
		await waitFor(() => copy.sheet.rendered, 'the token sheet to render');
		await settle(600);
		expect(copy.sheet.constructor).toBe(monsterEntry().cls);
		expect(copy.sheet.element.querySelector('[role="tab"]')).toBeTruthy();
		await copy.sheet.close();
	}, 30_000);
});
