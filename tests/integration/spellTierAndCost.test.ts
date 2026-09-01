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

import { beforeAll, describe, expect, test } from 'vitest';
import { buildCharacter, levelCharacterTo } from './builders/buildCharacter.ts';
import { importPackItem, purgeTestDocuments, settle } from './liveHelpers.ts';

const TEST_PREFIX = 'V14 Spell Tier And Cost';

interface CasterActor {
	id: string;
	classes: Record<string, { id: string; identifier: string }>;
	system: {
		classData: { levels: string[] };
		resources: { mana: { current: number; max: number }; highestUnlockedSpellTier: number | null };
	};
	levels: { character: number };
	items: { contents: Array<{ id: string; name: string; type: string }> };
	updateItem(itemId: string, changes: Record<string, unknown>): Promise<unknown>;
	update(changes: Record<string, unknown>): Promise<unknown>;
}

async function buildCaster(suffix: string, className: string, level = 1): Promise<CasterActor> {
	const actor = await buildCharacter({
		name: `${TEST_PREFIX} ${suffix}`,
		className,
		level,
	});
	return actor as unknown as CasterActor;
}

async function levelTo(actor: CasterActor, level: number): Promise<void> {
	await levelCharacterTo(actor as never, level);
	await settle();
}

describe("a Shadowmancer's unlocked tier follows the class's own grants", () => {
	let shadowmancer: CasterActor;

	beforeAll(async () => {
		await purgeTestDocuments(TEST_PREFIX);
		shadowmancer = await buildCaster('Shadowmancer', 'Shadowmancer');
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
		await levelTo(shadowmancer, level);

		expect(shadowmancer.system.resources.highestUnlockedSpellTier).toBe(expected);
	});
});

/**
 * The Mage is on a different ladder from the Shadowmancer, and reads it from a
 * different feature. Both are here so the derivation is shown to follow each
 * class's own grants rather than one shared table.
 */
describe("a Mage's unlocked tier follows its own ladder", () => {
	let mage: CasterActor;

	beforeAll(async () => {
		mage = await buildCaster('Mage Ladder', 'Mage');
	});

	test.each([
		[1, 0],
		[2, 1],
		[4, 2],
		[6, 3],
	])('at level %i the highest unlocked tier is %i', async (level, expected) => {
		await levelTo(mage, level);

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
	let shadowmancer: CasterActor;

	beforeAll(async () => {
		shadowmancer = await buildCaster('Override', 'Shadowmancer', 7);
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

/**
 * What a cast actually costs. The Shadowmancer pays from Pilfered Power, a
 * charge pool stored on the feature that grants it, and pays one use whatever
 * tier the spell resolves at. The Mage is here as the control: nothing about
 * the pool-paying class may change what a mana caster spends.
 */
describe('casting spends the resource the class declares', () => {
	const poolOf = (actor: CasterActor, itemName: string) => {
		const item = actor.items.contents.find((entry) => entry.name === itemName)!;
		const pools = (item as unknown as { flags: Record<string, any> }).flags[game.system.id]
			?.chargePools;
		return pools?.['pilfered-power'] as { current: number; max: number } | undefined;
	};

	test('a Shadowmancer spends one use of Pilfered Power, not mana', async () => {
		// The builder grants what a Shadowmancer of this level holds, Pilfered
		// Power included, so the test never names the feature it depends on.
		const shadowmancer = await buildCaster('Casting', 'Shadowmancer', 10);

		const spell = await importPackItem(
			shadowmancer as unknown as Actor,
			'nimble-spells',
			(entry: { name: string }) => entry.name === 'Shadow Trap',
			[],
		);
		await settle();

		const before = poolOf(shadowmancer, 'Pilfered Power')!;
		expect(before.current).toBeGreaterThan(0);

		await (spell as unknown as { activate(options: object): Promise<unknown> }).activate({
			fastForward: true,
		});
		await settle();

		const after = poolOf(shadowmancer, 'Pilfered Power')!;
		expect(after.current).toBe(before.current - 1);
		expect(shadowmancer.system.resources.mana.current).toBe(0);
	});

	test('a Mage still spends the spell tier in mana', async () => {
		const mage = await buildCaster('Mana Control', 'Mage', 4);

		const spell = await importPackItem(
			mage as unknown as Actor,
			'nimble-spells',
			(entry: { name: string; system?: { tier?: number } }) => entry.name === 'Shadow Trap',
			['system.tier'],
		);
		await settle();

		const manaBefore = mage.system.resources.mana.current;
		expect(manaBefore).toBeGreaterThan(0);

		await (spell as unknown as { activate(options: object): Promise<unknown> }).activate({
			fastForward: true,
		});
		await settle();

		expect(mage.system.resources.mana.current).toBe(manaBefore - 1);
	});
});
