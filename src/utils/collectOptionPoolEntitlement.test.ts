import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildRealIndex, restoreMocks } from '../../tests/fixtures/classProgression.ts';
import collectOptionPoolEntitlement, {
	type OptionPoolEntitlement,
} from './collectOptionPoolEntitlement.ts';
import type { ClassFeatureIndex } from './getClassFeatures.ts';

/**
 * Drives the real compendium, so the pools and granted counts asserted here are the ones the
 * books print rather than a fixture's idea of them.
 */

let index: ClassFeatureIndex;

beforeAll(async () => {
	index = await buildRealIndex();
});

afterAll(() => {
	restoreMocks();
});

const DIE = 'Compendium.nimble.nimble-class-features.Item.WnKpJ8RvCb4mX2Qt';

function findPool(pools: OptionPoolEntitlement[], group: string) {
	return pools.find((pool) => pool.poolGroups.includes(group));
}

/** The real index with a group cut down to one member, which no shipped class pool is. */
function indexWithOneMember(group: string): ClassFeatureIndex {
	let kept: string | null = null;
	return new Map(
		[...index].map(([key, levels]) => [
			key,
			new Map(
				[...levels].map(([level, entries]) => [
					level,
					entries.filter((entry) => {
						if (entry.group !== group) return true;
						kept ??= entry.uuid;
						return entry.uuid === kept;
					}),
				]),
			),
		]),
	);
}

describe('collectOptionPoolEntitlement', () => {
	it('grants five picks from the merged Combat Ability pool of a level 9 Commander', async () => {
		const pools = await collectOptionPoolEntitlement(index, 'commander', 9, null);

		const merged = findPool(pools, 'combat-tactics');
		expect(merged?.poolGroups).toEqual(['commanders-orders', 'combat-tactics']);
		expect(merged?.grantedCount).toBe(5);
		expect(findPool(pools, 'weapon-mastery')?.grantedCount).toBe(1);
	});

	it('lists one slot per level that offers the merged Commander pool', async () => {
		const pools = await collectOptionPoolEntitlement(index, 'commander', 9, null);

		expect(findPool(pools, 'combat-tactics')?.slots).toEqual([
			{ level: 2, groups: ['commanders-orders'], count: 2, optionLabel: null },
			{ level: 4, groups: ['combat-tactics'], count: 1, optionLabel: 'Choose a Combat Tactic' },
			{
				level: 6,
				groups: ['combat-tactics', 'commanders-orders'],
				count: 1,
				optionLabel: null,
			},
			{
				level: 8,
				groups: ['combat-tactics', 'commanders-orders'],
				count: 1,
				optionLabel: null,
			},
		]);
	});

	it('offers the item an alternative grants outright, and marks it repeatable', async () => {
		const pools = await collectOptionPoolEntitlement(index, 'commander', 9, null);

		const merged = findPool(pools, 'combat-tactics');
		expect(merged?.candidateUuids).toContain(DIE);
		expect(merged?.repeatableUuids).toEqual([DIE]);
	});

	it('grants three picks from the Berserker Savage Arsenal pool at level 8', async () => {
		const pools = await collectOptionPoolEntitlement(index, 'berserker', 8, null);

		const pool = findPool(pools, 'savage-arsenal');
		expect(pool?.grantedCount).toBe(3);
		expect(pool?.slots.map((slot) => slot.count)).toEqual([1, 1, 1]);
	});

	it('grants nothing without a class', async () => {
		expect(await collectOptionPoolEntitlement(index, '', 10, null)).toEqual([]);
	});

	it('grants nothing below level 1', async () => {
		expect(await collectOptionPoolEntitlement(index, 'commander', 0, null)).toEqual([]);
	});

	it('grants nothing at a level before the class offers a pool', async () => {
		expect(await collectOptionPoolEntitlement(index, 'commander', 1, null)).toEqual([]);
	});

	it('counts a level that offers a choice between alternatives once', async () => {
		// The Commander's level 8 offers a Combat Ability OR a bigger Combat Die, which is one
		// pick whichever way it went.
		const atSeven = await collectOptionPoolEntitlement(index, 'commander', 7, null);
		const atEight = await collectOptionPoolEntitlement(index, 'commander', 8, null);

		expect(findPool(atEight, 'combat-tactics')?.grantedCount).toBe(
			(findPool(atSeven, 'combat-tactics')?.grantedCount ?? 0) + 1,
		);
	});

	it('narrows the pool to the groups named, and keeps each slot to the groups its level named', async () => {
		const pools = await collectOptionPoolEntitlement(
			index,
			'commander',
			9,
			new Set(['commanders-orders']),
		);

		expect(pools).toHaveLength(1);
		expect(pools[0].poolGroups).toEqual(['commanders-orders']);
		expect(pools[0].slots.map((slot) => [slot.level, slot.groups])).toEqual([
			[2, ['commanders-orders']],
			[6, ['combat-tactics', 'commanders-orders']],
			[8, ['combat-tactics', 'commanders-orders']],
		]);
	});

	it('grants a pool with a single candidate, which offers nothing to swap to', async () => {
		const pools = await collectOptionPoolEntitlement(
			indexWithOneMember('savage-arsenal'),
			'berserker',
			8,
			null,
		);

		const pool = findPool(pools, 'savage-arsenal');
		expect(pool?.candidateUuids).toHaveLength(1);
		expect(pool?.grantedCount).toBe(3);
	});
});
