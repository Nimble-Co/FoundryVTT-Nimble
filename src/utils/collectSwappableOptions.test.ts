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

/** The first `count` members of a pool, standing in for the picks a character made. */
function owning(group: string, count: number): Set<string> {
	return new Set(poolMembers(group).slice(0, count));
}

describe('collectSwappableOptions', () => {
	it('finds a pool whose offer level is not the current level', async () => {
		// The Hunter's Thrill of the Hunt is offered at 2, 4, 6, 8, 12 and 14 — never at 10.
		// Asking the resolver about level 10 alone returns nothing, which is the whole reason
		// this replays the levels below.
		const pools = await collectSwappableOptions(
			index,
			'hunter',
			10,
			owning('thrill-of-the-hunt', 5),
			null,
		);

		expect(findPool(pools, 'thrill-of-the-hunt')).toBeDefined();
	});

	it('counts the picks the character holds, not the ones their levels entitled them to', async () => {
		const pools = await collectSwappableOptions(
			index,
			'hunter',
			10,
			owning('thrill-of-the-hunt', 5),
			null,
		);

		expect(findPool(pools, 'thrill-of-the-hunt')?.pickCount).toBe(5);
	});

	it('counts a pool whose levels offer a choice between options', async () => {
		// The Commander's level 6, 8, 10, 12 and 16 each offer a Combat Ability OR a max Combat
		// Die, and which was taken is never recorded, so the levels tell us nothing. Counting
		// what the character holds is what keeps their six tactics swappable.
		const pools = await collectSwappableOptions(
			index,
			'commander',
			16,
			owning('combat-tactics', 5),
			null,
		);

		expect(findPool(pools, 'combat-tactics')?.pickCount).toBe(5);
	});

	it('offers the whole pool, not just the members tied to one level', async () => {
		const pools = await collectSwappableOptions(
			index,
			'berserker',
			8,
			owning('savage-arsenal', 2),
			null,
		);

		expect(findPool(pools, 'savage-arsenal')?.candidateUuids).toHaveLength(
			poolMembers('savage-arsenal').length,
		);
	});

	it('reports which members the character currently holds', async () => {
		const [first, second] = poolMembers('savage-arsenal');

		const pools = await collectSwappableOptions(
			index,
			'berserker',
			8,
			new Set([first, second]),
			null,
		);

		expect(findPool(pools, 'savage-arsenal')?.ownedUuids).toEqual([first, second]);
	});

	it('records the levels that contributed picks', async () => {
		const pools = await collectSwappableOptions(
			index,
			'hunter',
			8,
			owning('thrill-of-the-hunt', 5),
			null,
		);

		expect(findPool(pools, 'thrill-of-the-hunt')?.levels).toEqual([2, 4, 6, 8]);
	});

	it('offers nothing from a pool the character has no picks in', async () => {
		const pools = await collectSwappableOptions(index, 'berserker', 8, new Set(), null);

		expect(findPool(pools, 'savage-arsenal')).toBeUndefined();
	});

	it('narrows to the pools a rule names', async () => {
		const owned = new Set([...owning('commanders-orders', 2), ...owning('combat-tactics', 2)]);

		const pools = await collectSwappableOptions(
			index,
			'commander',
			12,
			owned,
			new Set(['commanders-orders']),
		);

		expect(pools).toHaveLength(1);
		expect(pools[0].poolGroups).toContain('commanders-orders');
	});

	it('returns every pool when no groups are named', async () => {
		const owned = new Set([...owning('commanders-orders', 2), ...owning('combat-tactics', 2)]);

		const all = await collectSwappableOptions(index, 'commander', 12, owned, null);
		const narrowed = await collectSwappableOptions(
			index,
			'commander',
			12,
			owned,
			new Set(['commanders-orders']),
		);

		expect(all.length).toBeGreaterThan(narrowed.length);
	});

	it('returns nothing for a level below the first offer', async () => {
		const pools = await collectSwappableOptions(
			index,
			'berserker',
			3,
			owning('savage-arsenal', 1),
			null,
		);

		expect(findPool(pools, 'savage-arsenal')).toBeUndefined();
	});

	it('returns nothing without a class', async () => {
		expect(await collectSwappableOptions(index, '', 10, new Set(), null)).toEqual([]);
	});

	it('sorts pools by the level they first appear at', async () => {
		const owned = new Set([
			...owning('commanders-orders', 2),
			...owning('combat-tactics', 2),
			...owning('weapon-mastery', 2),
		]);

		const pools = await collectSwappableOptions(index, 'commander', 16, owned, null);
		const firstLevels = pools.map((pool) => pool.levels[0]);

		expect(firstLevels).toEqual([...firstLevels].sort((a, b) => a - b));
	});
});
