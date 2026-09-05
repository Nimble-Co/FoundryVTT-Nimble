import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
	buildRealIndex,
	loadAllFeatureDocs,
	restoreMocks,
} from '../../tests/fixtures/classProgression.ts';
import collectSwappableOptions from './collectSwappableOptions.ts';
import type { ClassFeatureIndex } from './getClassFeatures.ts';

/**
 * Drives the real compendium, so the pools and pick counts asserted here are the ones the
 * books print rather than a fixture's idea of them.
 */

let index: ClassFeatureIndex;

beforeAll(async () => {
	index = await buildRealIndex();
});

afterAll(() => {
	restoreMocks();
});

/** Every member of a pool, as compendium-source uuids. */
function poolMembers(group: string): string[] {
	return loadAllFeatureDocs()
		.filter((feature) => !feature.system.subclass && feature.system.group === group)
		.map((feature) => feature.uuid);
}

function findPool(pools: Awaited<ReturnType<typeof collectSwappableOptions>>, group: string) {
	return pools.find((pool) => pool.poolGroups.includes(group));
}

describe('collectSwappableOptions', () => {
	it('finds a pool whose offer level is not the current level', async () => {
		// The Hunter's Thrill of the Hunt is offered at 2, 4, 6, 8, 12 and 14 — never at 10.
		// Asking the resolver about level 10 alone returns nothing, which is the whole reason
		// this replays the levels below.
		const pools = await collectSwappableOptions(index, 'hunter', 10, new Set(), null);

		expect(findPool(pools, 'thrill-of-the-hunt')).toBeDefined();
	});

	it('sums the picks a pool has granted up to the current level', async () => {
		// Levels 2 (two picks), 4, 6 and 8 (one each) have happened by level 10; 12 and 14 have not.
		const pools = await collectSwappableOptions(index, 'hunter', 10, new Set(), null);

		expect(findPool(pools, 'thrill-of-the-hunt')?.pickCount).toBe(5);
	});

	it('grows the pick count as the character levels', async () => {
		const atTwelve = await collectSwappableOptions(index, 'hunter', 12, new Set(), null);
		const atFourteen = await collectSwappableOptions(index, 'hunter', 14, new Set(), null);

		expect(findPool(atTwelve, 'thrill-of-the-hunt')?.pickCount).toBe(6);
		expect(findPool(atFourteen, 'thrill-of-the-hunt')?.pickCount).toBe(7);
	});

	it('offers the whole pool, not just the members tied to one level', async () => {
		const pools = await collectSwappableOptions(index, 'berserker', 8, new Set(), null);
		const savageArsenal = findPool(pools, 'savage-arsenal');

		expect(savageArsenal?.candidateUuids).toHaveLength(poolMembers('savage-arsenal').length);
	});

	it('reports which members the character currently holds', async () => {
		const [first, second] = poolMembers('savage-arsenal');
		const owned = new Set([first, second]);

		const pools = await collectSwappableOptions(index, 'berserker', 8, owned, null);

		expect(findPool(pools, 'savage-arsenal')?.ownedUuids).toEqual([first, second]);
	});

	it('records the levels that contributed picks', async () => {
		const pools = await collectSwappableOptions(index, 'hunter', 8, new Set(), null);

		expect(findPool(pools, 'thrill-of-the-hunt')?.levels).toEqual([2, 4, 6, 8]);
	});

	it('narrows to the pools a rule names', async () => {
		const pools = await collectSwappableOptions(
			index,
			'commander',
			12,
			new Set(),
			new Set(['commanders-orders']),
		);

		expect(pools).toHaveLength(1);
		expect(pools[0].poolGroups).toContain('commanders-orders');
	});

	it('returns every pool when no groups are named', async () => {
		const all = await collectSwappableOptions(index, 'commander', 12, new Set(), null);
		const narrowed = await collectSwappableOptions(
			index,
			'commander',
			12,
			new Set(),
			new Set(['commanders-orders']),
		);

		expect(all.length).toBeGreaterThan(narrowed.length);
	});

	it('returns nothing for a level below the first offer', async () => {
		const pools = await collectSwappableOptions(index, 'berserker', 3, new Set(), null);

		expect(findPool(pools, 'savage-arsenal')).toBeUndefined();
	});

	it('returns nothing without a class', async () => {
		expect(await collectSwappableOptions(index, '', 10, new Set(), null)).toEqual([]);
	});

	it('sorts pools by the level they first appear at', async () => {
		const pools = await collectSwappableOptions(index, 'commander', 16, new Set(), null);
		const firstLevels = pools.map((pool) => pool.levels[0]);

		expect(firstLevels).toEqual([...firstLevels].sort((a, b) => a - b));
	});
});
