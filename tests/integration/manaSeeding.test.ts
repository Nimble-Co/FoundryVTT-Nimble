/**
 * Live regression tests for mana seeding, exercised against real Mage content.
 *
 * A caster's mana maximum is zero at level 1 and only rises at level 2, so the
 * current value has to be filled at the moment the maximum first appears. The
 * unit suite pins the hook's logic against mocks, but it cannot confirm the two
 * runtime facts the hook rests on: that Foundry recomputes derived data before
 * the `updateActor` hook runs, and that a value stashed on the update options
 * survives to the post-hook. Both are only observable in a real world.
 *
 * Levelling back down is covered here too, because the seed is what makes a
 * stranded current value reachable: a pool filled to 2/2 at level 2 would
 * otherwise keep its 2 while the maximum returns to 0.
 */

import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { importPackItem, purgeTestDocuments, settle } from './liveHelpers.ts';

const TEST_PREFIX = 'V14 Mana Seeding';

interface ManaActor {
	id: string;
	classes: Record<string, { id: string; identifier: string }>;
	system: {
		classData: { levels: string[] };
		levelUpHistory: unknown[];
		resources: { mana: { current: number; max: number; baseMax: number } };
	};
	levels: { character: number };
	updateItem(itemId: string, changes: Record<string, unknown>): Promise<unknown>;
	revertLastLevelUp(): Promise<unknown>;
	update(changes: Record<string, unknown>): Promise<unknown>;
}

const readMana = (actor: ManaActor) => ({ ...actor.system.resources.mana });

describe('mana seeding across a level up and back down', () => {
	let mage: ManaActor;

	beforeAll(async () => {
		await purgeTestDocuments(TEST_PREFIX);
		mage = (await Actor.create({
			name: `${TEST_PREFIX} Mage`,
			type: 'character',
		} as Actor.CreateData)) as unknown as ManaActor;
		await importPackItem(
			mage as unknown as Actor,
			'nimble-classes',
			(entry: { name: string }) => entry.name === 'Mage',
			[],
		);
		await settle();
	});

	afterAll(async () => {
		await purgeTestDocuments(TEST_PREFIX);
	});

	test('a level 1 Mage has no pool yet', () => {
		expect(readMana(mage)).toMatchObject({ current: 0, max: 0 });
	});

	test('levelling to 2 fills the pool the class just granted', async () => {
		// The two writes the level-up path makes once its dialog has collected
		// the player's choices. The dialog itself is not what is under test.
		const characterClass = Object.values(mage.classes)[0]!;
		await mage.updateItem(characterClass.id, { 'system.classLevel': 2 });
		await mage.update({
			'system.classData.levels': [
				...mage.system.classData.levels,
				characterClass.identifier,
			],
			'system.levelUpHistory': [
				{
					level: 2,
					hpIncrease: 0,
					abilityIncreases: {},
					skillIncreases: {},
					hitDieAdded: false,
					classIdentifier: characterClass.identifier,
					grantedFeatureIds: [],
					grantedSpellIds: [],
					poolMaxBonuses: {},
				},
			],
		});
		await settle();

		const mana = readMana(mage);
		expect(mana.max).toBeGreaterThan(0);
		expect(mana.current).toBe(mana.max);
	});

	test('levelling back down leaves no value stranded above the maximum', async () => {
		await mage.revertLastLevelUp();
		await settle();

		const mana = readMana(mage);
		expect(mage.levels.character).toBe(1);
		expect(mana.max).toBe(0);
		expect(mana.current).toBeLessThanOrEqual(mana.max);
	});
});
