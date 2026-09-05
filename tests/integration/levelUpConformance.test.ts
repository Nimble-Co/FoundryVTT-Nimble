/**
 * Checks the character builder's central assumption against the real interface.
 *
 * The builder grants a level's features itself, so something has to confirm it
 * grants the same ones the game does. This levels a character through the sheet
 * and the level up dialog, clicking what a player clicks, and asserts the
 * feature arrives on its own. If the level up path ever grants something else,
 * this fails and the builder's derivation is known to be stale.
 */

import { afterAll, expect, test } from 'vitest';
import { importPackItem, purgeTestDocuments, settle, waitFor } from './liveHelpers.ts';

const TEST_PREFIX = 'V14 LevelUp Prototype';

test('a Shadowmancer levelled through the real UI gains Pilfered Power on its own', async () => {
	await purgeTestDocuments(TEST_PREFIX);

	const actor = (await Actor.create({
		name: `${TEST_PREFIX} Shadowmancer`,
		type: 'character',
	} as Actor.CreateData)) as unknown as Actor & {
		sheet: {
			render(force: boolean): Promise<unknown>;
			element: HTMLElement;
			close(): Promise<unknown>;
		};
		items: { contents: Array<{ name: string; type: string }> };
		levels: { character: number };
		system: any;
	};

	// A real character has its stats before it takes a level.
	await actor.update({ 'system.abilities.dexterity.baseValue': 3 } as never);
	await importPackItem(
		actor as unknown as Actor,
		'nimble-classes',
		(entry: { name: string }) => entry.name === 'Shadowmancer',
		[],
	);
	await settle();

	// Open the sheet and press Level Up, exactly as a player would.
	await actor.sheet.render(true);
	await waitFor(() => !!actor.sheet.element, 'sheet element');
	await settle(300);

	// The level-up control only exists once the sheet is unlocked, which is a
	// step the player takes too.
	const editToggle = [...actor.sheet.element.querySelectorAll('button')].find(
		(button) => button.getAttribute('aria-label') === 'Enable editing',
	);
	expect(editToggle, 'the sheet offers an editing toggle').toBeTruthy();
	editToggle!.click();
	await settle(300);

	const levelUpButton = [...actor.sheet.element.querySelectorAll('button')].find(
		(button) => button.getAttribute('aria-label') === 'Level Up',
	);
	expect(levelUpButton, 'the sheet offers a Level Up button').toBeTruthy();
	levelUpButton!.click();

	// The dialog is a separate application window; find it by a control only it has.
	await waitFor(
		() => !!document.querySelector('.nimble-hit-point-selection'),
		'level up dialog to render',
	);
	const dialogRoot = document
		.querySelector('.nimble-hit-point-selection')!
		.closest('.application') as HTMLElement;
	expect(dialogRoot, 'the dialog has an application root').toBeTruthy();

	// Take average HP so the level up is deterministic.
	const averageOption = dialogRoot.querySelector<HTMLInputElement>(
		'input[type="radio"][value="average"]',
	);
	expect(averageOption, 'the dialog offers an average-HP option').toBeTruthy();
	averageOption!.click();
	await settle(200);

	// Spend whatever the dialog still wants: click the first enabled increment
	// until Submit unlocks. A real helper would let a test name its choices; the
	// question here is only whether the controls can be driven at all.
	const submitButton = () =>
		[...dialogRoot.querySelectorAll<HTMLButtonElement>('.nimble-sheet__footer button')][0];
	for (let i = 0; i < 20 && submitButton()?.disabled; i += 1) {
		const increment = [...dialogRoot.querySelectorAll<HTMLButtonElement>('button')].find(
			(button) =>
				!button.disabled && button.getAttribute('aria-label') === 'Increment Skill Points',
		);
		if (!increment) break;
		increment.click();
		await settle(150);
	}

	const footerButtons = [
		...dialogRoot.querySelectorAll<HTMLButtonElement>('.nimble-sheet__footer button'),
	];
	const submit = footerButtons.find((button) => !button.disabled);
	expect(submit, 'the dialog has an enabled submit button').toBeTruthy();
	submit!.click();

	await waitFor(() => actor.system.levelUpHistory.length > 0, 'the level up to be applied', {
		timeout: 15_000,
	});
	await settle(500);

	// What the system granted, without the test naming any of it.
	const names = actor.items.contents.map((item) => item.name);
	expect(actor.levels.character).toBe(2);
	expect(names).toContain('Master of Darkness');
	expect(names).toContain('Pilfered Power');

	const pilfered = actor.items.contents.find((item) => item.name === 'Pilfered Power')!;
	const pool = (pilfered as unknown as { flags: Record<string, any> }).flags[game.system.id]
		?.chargePools?.['pilfered-power'];
	expect(pool, 'Pilfered Power seeded its pool').toBeTruthy();
	expect(pool.max).toBe(3);
	expect(pool.current).toBe(3);

	await actor.sheet.close();
});

afterAll(async () => {
	await purgeTestDocuments(TEST_PREFIX);
});
