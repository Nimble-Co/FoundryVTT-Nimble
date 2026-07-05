/**
 * Batch 7 (final QA) regression tests: every actor and item sheet subtype
 * survives the open → edit → close → reopen cycle on live Foundry V14.
 *
 * The "edit" step updates the document while its sheet is open, which
 * exercises the V14 ApplicationV2 re-render path plus Nimble's Svelte
 * reactivity bridge — the pieces the V13→V14 migration touched. Keystroke-
 * level input binding is unchanged Svelte code and is covered by manual QA.
 */

import { afterAll, describe, expect, test } from 'vitest';

const NAME_PREFIX = 'V14 Sheet Edit Test';

const ACTOR_SUBTYPES = ['character', 'minion', 'npc', 'soloMonster'] as const;
const ITEM_SUBTYPES = [
	'ancestry',
	'background',
	'boon',
	'class',
	'feature',
	'monsterFeature',
	'object',
	'spell',
	'subclass',
] as const;

const settle = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function editRoundTrip(document: Actor | Item, subtype: string) {
	const sheet = document.sheet!;
	await sheet.render(true);
	await settle(500);
	expect(sheet.rendered, `${subtype} sheet should render`).toBe(true);
	expect((sheet.element as HTMLElement).isConnected).toBe(true);
	expect((sheet.element as HTMLElement).querySelector('[class*="nimble"]')).toBeTruthy();

	// Edit a field while the sheet is open.
	const editedName = `${document.name} (edited)`;
	await document.update({ name: editedName });
	await settle(400);
	expect(document.name).toBe(editedName);
	expect(sheet.rendered, `${subtype} sheet should survive an update`).toBe(true);
	expect((sheet.element as HTMLElement).isConnected).toBe(true);

	await sheet.close();
	await settle(200);
	expect(sheet.rendered).toBe(false);

	// Reopen.
	await sheet.render(true);
	await settle(500);
	expect(sheet.rendered, `${subtype} sheet should reopen`).toBe(true);
	expect((sheet.element as HTMLElement).querySelector('[class*="nimble"]')).toBeTruthy();
	await sheet.close();
}

describe('sheet edit round-trips', () => {
	afterAll(async () => {
		for (const app of foundry.applications.instances.values()) {
			await app.close().catch(() => {});
		}
		for (const actor of game.actors.filter((a) => a.name?.startsWith(NAME_PREFIX))) {
			await actor.delete().catch((error) => console.error(error));
		}
		for (const item of game.items.filter((i) => i.name?.startsWith(NAME_PREFIX))) {
			await item.delete().catch((error) => console.error(error));
		}
	});

	test.each([...ACTOR_SUBTYPES])(
		'%s sheet: open → edit → close → reopen',
		async (subtype) => {
			const actor = await Actor.create({ name: `${NAME_PREFIX} ${subtype}`, type: subtype });
			expect(actor).toBeDefined();
			await editRoundTrip(actor!, subtype);
			await actor!.delete();
		},
		30_000,
	);

	test.each([...ITEM_SUBTYPES])(
		'%s sheet: open → edit → close → reopen',
		async (subtype) => {
			const item = await Item.create({ name: `${NAME_PREFIX} ${subtype}`, type: subtype });
			expect(item).toBeDefined();
			await editRoundTrip(item!, subtype);
			await item!.delete();
		},
		30_000,
	);
});
