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

/** Every member of a pool that a level offers, as compendium-source uuids. */
function poolMembers(group: string): string[] {
	return loadAllFeatureDocs()
		.filter(
			(feature) =>
				!feature.system.subclass &&
				feature.system.group === group &&
				feature.system.gainedAtLevels.length > 0,
		)
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

	it('offers an item an alternative grants outright as a member of the pool', async () => {
		// The Commander may take +1 max Combat Die instead of a Combat Ability, and the die is
		// a granted item rather than a pool member. It has to be tradeable both ways.
		const pools = await collectSwappableOptions(
			index,
			'commander',
			16,
			owning('combat-tactics', 2),
			null,
		);

		expect(
			findPool(pools, 'combat-tactics')?.candidateUuids.some((uuid) =>
				uuid.endsWith('WnKpJ8RvCb4mX2Qt'),
			),
		).toBe(true);
	});

	it('counts a held granted item as one of the picks', async () => {
		const die = 'Compendium.nimble.nimble-class-features.Item.WnKpJ8RvCb4mX2Qt';
		const pools = await collectSwappableOptions(
			index,
			'commander',
			16,
			new Set([...owning('combat-tactics', 2), die]),
			null,
		);

		const pool = findPool(pools, 'combat-tactics');
		expect(pool?.ownedUuids).toContain(die);
		expect(pool?.pickCount).toBe(3);
	});

	it('merges pools that share a group, so no pick counts twice', async () => {
		// A Combat Ability may come from either Commander pool, so the two pools are one.
		const owned = new Set([...owning('commanders-orders', 2), ...owning('combat-tactics', 2)]);

		const pools = await collectSwappableOptions(index, 'commander', 16, owned, null);
		const merged = findPool(pools, 'combat-tactics');

		expect(merged?.poolGroups).toEqual(['combat-tactics', 'commanders-orders']);
		expect(merged?.pickCount).toBe(4);
		expect(pools.filter((pool) => pool.poolGroups.includes('commanders-orders'))).toHaveLength(1);
	});

	it('keeps a narrowed pool to the groups the rule names', async () => {
		const owned = new Set([...owning('commanders-orders', 2), ...owning('combat-tactics', 2)]);

		const pools = await collectSwappableOptions(
			index,
			'commander',
			16,
			owned,
			new Set(['combat-tactics']),
		);

		expect(pools).toHaveLength(1);
		expect(pools[0].poolGroups).toEqual(['combat-tactics']);
		expect(pools[0].pickCount).toBe(2);
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
		const owned = new Set([
			...owning('commanders-orders', 2),
			...owning('combat-tactics', 2),
			...owning('weapon-mastery', 1),
		]);

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
