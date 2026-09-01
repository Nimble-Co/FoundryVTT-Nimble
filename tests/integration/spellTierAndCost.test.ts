/**
 * Live tests for what a caster may cast and what it costs them.
 *
 * The unit suite pins both against mocks, but two facts only a real world can
 * settle. The unlocked tier is now derived from the spell grants authored on a
 * character's own class and feature items, read through the rules engine, so it
 * depends on rule preparation running and on each grant's level predicate being
 * evaluated against the character. And a cast that spends from a charge pool
 * writes through the pool's flag storage on the item that grants it, which no
 * mock exercises end to end.
 */

import { afterEach, beforeAll, describe, expect, test } from 'vitest';
import {
	buildCharacter,
	type CharacterActor,
	levelCharacterTo,
} from './builders/buildCharacter.ts';
import { importPackItem, purgeTestDocuments, settle, waitFor } from './liveHelpers.ts';

const TEST_PREFIX = 'V14 Spell Tier And Cost';

describe("a Shadowmancer's unlocked tier follows the class's own grants", () => {
	let shadowmancer: CharacterActor;

	beforeAll(async () => {
		await purgeTestDocuments(TEST_PREFIX);
		shadowmancer = await buildCharacter({
			name: `${TEST_PREFIX} Shadowmancer`,
			className: 'Shadowmancer',
		});
	});

	// The ladder printed for the class: tier 1 at level 2, then 5, 7, 10.
	test.each([
		[1, 0],
		[2, 1],
		[4, 1],
		[5, 2],
		[7, 3],
		[10, 4],
	])('at level %i the highest unlocked tier is %i', async (level, expected) => {
		await levelCharacterTo(shadowmancer, level);

		expect(shadowmancer.system.resources.highestUnlockedSpellTier).toBe(expected);
	});
});

/**
 * The Mage is on a different ladder from the Shadowmancer, and reads it from a
 * different feature. Both are here so the derivation is shown to follow each
 * class's own grants rather than one shared table.
 */
describe("a Mage's unlocked tier follows its own ladder", () => {
	let mage: CharacterActor;

	beforeAll(async () => {
		mage = await buildCharacter({ name: `${TEST_PREFIX} Mage Ladder`, className: 'Mage' });
	});

	test.each([
		[1, 0],
		[2, 1],
		[4, 2],
		[6, 3],
	])('at level %i the highest unlocked tier is %i', async (level, expected) => {
		await levelCharacterTo(mage, level);

		expect(mage.system.resources.highestUnlockedSpellTier).toBe(expected);
	});
});

/**
 * A stored number is a GM's override and a stored null means derive. The
 * distinction is only observable once derived data has run over a real
 * document, because the override is read from the source while the derived
 * value is what everything else reads.
 */
describe('a GM can override the unlocked tier and give it back', () => {
	let shadowmancer: CharacterActor;

	beforeAll(async () => {
		shadowmancer = await buildCharacter({
			name: `${TEST_PREFIX} Override`,
			className: 'Shadowmancer',
			level: 7,
		});
	});

	test('derives its own tier before anyone overrides it', () => {
		expect(shadowmancer.system.resources.highestUnlockedSpellTier).toBe(3);
	});

	test('an override holds instead of the derived tier', async () => {
		await shadowmancer.update({ 'system.resources.highestUnlockedSpellTier': 6 });
		await settle();

		expect(shadowmancer.system.resources.highestUnlockedSpellTier).toBe(6);
	});

	test('the override survives an unrelated update rather than being recomputed away', async () => {
		await shadowmancer.update({ 'system.attributes.sizeCategory': 'medium' });
		await settle();

		expect(shadowmancer.system.resources.highestUnlockedSpellTier).toBe(6);
	});

	test('clearing the override returns to deriving', async () => {
		await shadowmancer.update({ 'system.resources.highestUnlockedSpellTier': null });
		await settle();

		expect(shadowmancer.system.resources.highestUnlockedSpellTier).toBe(3);
	});
});

/** Drives the real cast window: what it quotes is what gets spent. */
describe('casting through the cast window spends what the window said', () => {
	// An open window leaks into the next file's dialog queries.
	afterEach(async () => {
		const open = castWindow();
		if (!open) return;
		const app = [...foundry.applications.instances.values()].find((instance: any) =>
			instance.element?.contains(open),
		) as { close(): Promise<unknown> } | undefined;
		await app?.close();
		await settle(200);
	});

	const castWindow = () => {
		const marker = document.querySelector('.nimble-spell-cost, .nimble-spell-pinned-tier');
		return (marker?.closest('.application') ?? null) as HTMLElement | null;
	};

	const openCastWindow = async (spell: unknown): Promise<HTMLElement> => {
		// Not awaited: activation only resolves once the dialog is answered.
		void (spell as { activate(options: object): Promise<unknown> }).activate({});
		await waitFor(() => !!castWindow(), 'the cast window to open', { timeout: 15_000 });
		await settle(400);
		return castWindow()!;
	};

	const pressCastSpell = async (root: HTMLElement) => {
		const cast = [...root.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
			button.textContent?.trim().startsWith('Cast Spell'),
		);
		expect(cast, 'the window offers a Cast Spell button').toBeTruthy();
		cast!.click();
		await settle(900);
	};

	const costText = (root: HTMLElement) =>
		root.querySelector('.nimble-spell-cost')?.textContent?.trim() ?? '';

	const poolOf = (actor: CharacterActor, itemName: string) => {
		const item = actor.items.contents.find((entry) => entry.name === itemName)!;
		const pools = item.flags[game.system.id]?.chargePools as
			| Record<string, { current: number; max: number }>
			| undefined;
		return pools?.['pilfered-power'];
	};

	test('a Shadowmancer is told the pool it pays, and pays one use', async () => {
		const shadowmancer = await buildCharacter({
			name: `${TEST_PREFIX} Casting`,
			className: 'Shadowmancer',
			level: 10,
		});
		const spell = await importPackItem(
			shadowmancer as never,
			'nimble-spells',
			(entry: { name: string }) => entry.name === 'Shadow Trap',
			[],
		);
		await settle();

		const before = poolOf(shadowmancer, 'Pilfered Power')!;
		expect(before.current).toBeGreaterThan(0);

		const root = await openCastWindow(spell);
		expect(costText(root)).toContain('Pilfered Power');
		expect(root.querySelector('.nimble-spell-pinned-tier')?.textContent).toContain('tier 4');

		await pressCastSpell(root);

		expect(poolOf(shadowmancer, 'Pilfered Power')!.current).toBe(before.current - 1);
		expect(shadowmancer.system.resources.mana.current).toBe(0);
	});

	test('a Mage is told the mana it pays, and pays the spell tier', async () => {
		const mage = await buildCharacter({
			name: `${TEST_PREFIX} Mana Control`,
			className: 'Mage',
			level: 4,
		});
		const spell = await importPackItem(
			mage as never,
			'nimble-spells',
			(entry: { name: string }) => entry.name === 'Ignite',
			['system.tier'],
		);
		await settle();

		const manaBefore = mage.system.resources.mana.current;
		expect(manaBefore).toBeGreaterThan(1);

		const root = await openCastWindow(spell);
		expect(costText(root)).toContain('1');

		await pressCastSpell(root);

		expect(mage.system.resources.mana.current).toBe(manaBefore - 1);
	});

	test('a Mage upcasting one step is charged the higher tier', async () => {
		const mage = await buildCharacter({
			name: `${TEST_PREFIX} Upcasting`,
			className: 'Mage',
			level: 4,
		});
		const spell = await importPackItem(
			mage as never,
			'nimble-spells',
			(entry: { name: string }) => entry.name === 'Ignite',
			['system.tier'],
		);
		await settle();

		const manaBefore = mage.system.resources.mana.current;
		const root = await openCastWindow(spell);

		// Scoped to the tier slider: the roll mode control is a slider too.
		const handle = root.querySelector<HTMLElement>('.nimble-mana-slider .rangeHandle');
		expect(handle, 'the window offers a tier slider').toBeTruthy();
		expect(handle!.getAttribute('aria-valuemax')).toBe('2');

		handle!.focus();
		handle!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
		await settle(400);

		expect(costText(root)).toContain('2');

		await pressCastSpell(root);

		expect(mage.system.resources.mana.current).toBe(manaBefore - 2);
	});
});
