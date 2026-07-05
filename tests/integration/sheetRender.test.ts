/**
 * Batch 2 (ApplicationV2) regression tests: sheets and dialogs render into the
 * live DOM on Foundry V14.
 */

import { afterAll, describe, expect, test } from 'vitest';

const TEST_ACTOR_NAME = 'V14 Sheet Render Test Actor';

describe('ApplicationV2 rendering', () => {
	afterAll(async () => {
		// Only close apps this suite opened: foundry.applications.instances also
		// holds the core UI applications (sidebar, chat log, …), and closing
		// those tears down the game UI for subsequent suites.
		for (const app of foundry.applications.instances.values()) {
			const doc = (app as { document?: { name?: string } }).document;
			const isTestSheet = doc?.name === TEST_ACTOR_NAME;
			const isCreationDialog = app.constructor.name === 'ActorCreationDialog';
			if (isTestSheet || isCreationDialog) await app.close().catch(() => {});
		}
		const leftovers = game.actors.filter((actor) => actor.name === TEST_ACTOR_NAME);
		for (const leftover of leftovers) {
			await leftover.delete().catch((error) => console.error(error));
		}
	});

	test('a character sheet renders into the live DOM and closes cleanly', async () => {
		const actor = await Actor.create({ name: TEST_ACTOR_NAME, type: 'character' });
		expect(actor).toBeDefined();

		const sheet = actor!.sheet!;
		await sheet.render(true);
		// Svelte mounts into the application content on first render.
		await new Promise((resolve) => setTimeout(resolve, 500));

		expect(sheet.rendered).toBe(true);
		const element = sheet.element as HTMLElement;
		expect(element.isConnected).toBe(true);
		// The Svelte root actually mounted something.
		expect(element.querySelector('.nimble-sheet__body, [class*="nimble"]')).toBeTruthy();

		await sheet.close();
		expect(sheet.rendered).toBe(false);

		await actor!.delete();
	});

	test('the actor creation dialog opens (V14 ApplicationV2#parent regression)', async () => {
		// V14 gave ApplicationV2 a getter-only `parent`; assigning to it from a
		// dialog constructor threw a TypeError. Opening the create-actor dialog
		// exercises that path.
		void game.actors.documentClass.createDialog({}, {}, {});
		await new Promise((resolve) => setTimeout(resolve, 1000));

		let creationDialog: foundry.applications.api.ApplicationV2 | undefined;
		for (const app of foundry.applications.instances.values()) {
			if (app.constructor.name === 'ActorCreationDialog') creationDialog = app;
		}

		expect(creationDialog).toBeDefined();
		expect(creationDialog!.rendered).toBe(true);
		expect((creationDialog!.element as HTMLElement).isConnected).toBe(true);

		await creationDialog!.close();
	});
});
