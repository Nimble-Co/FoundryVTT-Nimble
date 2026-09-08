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

const DIE = 'Compendium.nimble.nimble-class-features.Item.WnKpJ8RvCb4mX2Qt';

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

type Picks = Map<string, string[]>;

/**
 * Source uuid to the item ids that are picks of it, in granting order. Several entries for one
 * source fold together in the order given, so `picking(...)` calls can be chained.
 */
function picks(...entries: Array<[uuid: string, ...ids: string[]]>): Picks {
	const result: Picks = new Map();
	for (const [uuid, ...ids] of entries) {
		result.set(uuid, [...(result.get(uuid) ?? []), ...ids]);
	}
	return result;
}

/** One pick of each of the first `count` members of a pool. */
function picking(group: string, count: number, ...more: Picks[]): Picks {
	const result = picks(
		...poolMembers(group)
			.slice(0, count)
			.map((uuid, position): [string, string] => [uuid, `${group}-${position}`]),
	);
	for (const extra of more) {
		for (const [uuid, ids] of extra) result.set(uuid, [...(result.get(uuid) ?? []), ...ids]);
	}
	return result;
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
			picking('thrill-of-the-hunt', 5),
			null,
		);

		expect(findPool(pools, 'thrill-of-the-hunt')).toBeDefined();
	});

	it('counts the picks the history records, not the ones the levels entitled the character to', async () => {
		const pools = await collectSwappableOptions(
			index,
			'hunter',
			10,
			picking('thrill-of-the-hunt', 3),
			null,
		);

		expect(findPool(pools, 'thrill-of-the-hunt')?.pickCount).toBe(3);
	});

	it('counts a pool whose levels offer a choice between options', async () => {
		// The Commander's level 6, 8, 10, 12 and 16 each offer a Combat Ability OR a max Combat
		// Die, and which was taken is never recorded, so the levels tell us nothing. The
		// history records what each level granted, and that is what is counted.
		const pools = await collectSwappableOptions(
			index,
			'commander',
			16,
			picking('combat-tactics', 5),
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
			picking('combat-tactics', 2),
			null,
		);

		expect(findPool(pools, 'combat-tactics')?.candidateUuids).toContain(DIE);
	});

	it('counts a granted item with one pick as one of the picks', async () => {
		const pools = await collectSwappableOptions(
			index,
			'commander',
			16,
			picking('combat-tactics', 2, picks([DIE, 'die-6'])),
			null,
		);

		const pool = findPool(pools, 'combat-tactics');
		expect(pool?.pickIdsByUuid.get(DIE)).toEqual(['die-6']);
		expect(pool?.pickCount).toBe(3);
	});

	it('counts a source granted at two levels as two picks', async () => {
		const pools = await collectSwappableOptions(
			index,
			'commander',
			16,
			picking('combat-tactics', 2, picks([DIE, 'die-6', 'die-8'])),
			null,
		);

		const pool = findPool(pools, 'combat-tactics');
		expect(pool?.pickIdsByUuid.get(DIE)).toEqual(['die-6', 'die-8']);
		expect(pool?.pickCount).toBe(4);
	});

	it('keeps the pick ids in the order they were handed in', async () => {
		const pools = await collectSwappableOptions(
			index,
			'commander',
			16,
			picking('combat-tactics', 1, picks([DIE, 'die-8', 'die-6'])),
			null,
		);

		expect(findPool(pools, 'combat-tactics')?.pickIdsByUuid.get(DIE)).toEqual(['die-8', 'die-6']);
	});

	it('reports the right total for a mix of repeated and single picks', async () => {
		const [first, second, third] = poolMembers('combat-tactics');

		const pools = await collectSwappableOptions(
			index,
			'commander',
			16,
			picks([first, 'a'], [second, 'b'], [DIE, 'die-6', 'die-8'], [third, 'c']),
			null,
		);

		const pool = findPool(pools, 'combat-tactics');
		expect(pool?.pickCount).toBe(5);
		expect([...pool!.pickIdsByUuid.keys()]).toEqual(
			expect.arrayContaining([first, second, third, DIE]),
		);
	});

	it('leaves a member with no pick id out of the picks but in the candidates', async () => {
		const [first, second] = poolMembers('combat-tactics');

		const pools = await collectSwappableOptions(index, 'commander', 16, picks([first, 'a']), null);

		const pool = findPool(pools, 'combat-tactics');
		expect(pool?.pickIdsByUuid.has(second)).toBe(false);
		expect(pool?.candidateUuids).toContain(second);
	});

	it('ignores a source with an empty id list', async () => {
		const [first, second] = poolMembers('combat-tactics');

		const pools = await collectSwappableOptions(
			index,
			'commander',
			16,
			picks([first, 'a'], [second]),
			null,
		);

		const pool = findPool(pools, 'combat-tactics');
		expect(pool?.pickIdsByUuid.has(second)).toBe(false);
		expect(pool?.pickCount).toBe(1);
	});

	it('drops a pool whose members all have no pick ids', async () => {
		const pools = await collectSwappableOptions(
			index,
			'commander',
			16,
			picking('commanders-orders', 2),
			null,
		);

		expect(findPool(pools, 'weapon-mastery')).toBeUndefined();
	});

	it('matches a pick stored under the other system id to the same member', async () => {
		// A character exported from one install and imported into the other carries the
		// source under the other namespace. Under a raw comparison the die would go uncounted.
		const stored = DIE.replace('Compendium.nimble.', 'Compendium.nimble-dev.');

		const pools = await collectSwappableOptions(
			index,
			'commander',
			16,
			picking('combat-tactics', 1, picks([stored, 'die-6'])),
			null,
		);

		const pool = findPool(pools, 'combat-tactics');
		expect(pool?.pickIdsByUuid.get(DIE)).toEqual(['die-6']);
		expect(pool?.pickCount).toBe(2);
	});

	it('marks a member repeatable when its grant allows a duplicate', async () => {
		const [tactic] = poolMembers('combat-tactics');

		const pools = await collectSwappableOptions(
			index,
			'commander',
			16,
			picking('combat-tactics', 1),
			null,
		);

		const pool = findPool(pools, 'combat-tactics');
		expect(pool?.repeatableUuids).toEqual([DIE]);
		expect(pool?.repeatableUuids).not.toContain(tactic);
	});

	it('marks nothing repeatable in a pool with no such grant', async () => {
		const pools = await collectSwappableOptions(
			index,
			'berserker',
			8,
			picking('savage-arsenal', 2),
			null,
		);

		expect(findPool(pools, 'savage-arsenal')?.repeatableUuids).toEqual([]);
	});

	it('merges pools that share a group, so no pick counts twice', async () => {
		// A Combat Ability may come from either Commander pool, so the two pools are one.
		const held = picking('commanders-orders', 2, picking('combat-tactics', 2));

		const pools = await collectSwappableOptions(index, 'commander', 16, held, null);
		const merged = findPool(pools, 'combat-tactics');

		expect(merged?.poolGroups).toEqual(['combat-tactics', 'commanders-orders']);
		expect(merged?.pickCount).toBe(4);
		expect(pools.filter((pool) => pool.poolGroups.includes('commanders-orders'))).toHaveLength(1);
	});

	it('titles a merged pool from its groups when no feature lends it a name', async () => {
		const feature = loadAllFeatureDocs().find((doc) => doc.name === 'Fit for Any Battlefield');
		if (!feature) throw new Error('fixture feature missing');
		const held = picking('commanders-orders', 2, picking('combat-tactics', 2));

		feature.name = '';
		try {
			const pools = await collectSwappableOptions(index, 'commander', 16, held, null);
			expect(findPool(pools, 'combat-tactics')?.displayName).toBe(
				'Combat Tactics / Commanders Orders',
			);
		} finally {
			feature.name = 'Fit for Any Battlefield';
		}
	});

	it('keeps a narrowed pool to the groups the rule names', async () => {
		const held = picking('commanders-orders', 2, picking('combat-tactics', 2));

		const pools = await collectSwappableOptions(
			index,
			'commander',
			16,
			held,
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
			picking('savage-arsenal', 2),
			null,
		);

		expect(findPool(pools, 'savage-arsenal')?.candidateUuids).toHaveLength(
			poolMembers('savage-arsenal').length,
		);
	});

	it('reports which members the character has picks of', async () => {
		const [first, second] = poolMembers('savage-arsenal');

		const pools = await collectSwappableOptions(
			index,
			'berserker',
			8,
			picks([first, 'a'], [second, 'b']),
			null,
		);

		expect([...findPool(pools, 'savage-arsenal')!.pickIdsByUuid.keys()]).toEqual([first, second]);
	});

	it('records the levels that contributed picks', async () => {
		const pools = await collectSwappableOptions(
			index,
			'hunter',
			8,
			picking('thrill-of-the-hunt', 4),
			null,
		);

		expect(findPool(pools, 'thrill-of-the-hunt')?.levels).toEqual([2, 4, 6, 8]);
	});

	it('offers nothing from a pool the character has no picks in', async () => {
		const pools = await collectSwappableOptions(index, 'berserker', 8, new Map(), null);

		expect(findPool(pools, 'savage-arsenal')).toBeUndefined();
	});

	it('narrows to the pools a rule names', async () => {
		const held = picking('commanders-orders', 2, picking('combat-tactics', 2));

		const pools = await collectSwappableOptions(
			index,
			'commander',
			12,
			held,
			new Set(['commanders-orders']),
		);

		expect(pools).toHaveLength(1);
		expect(pools[0].poolGroups).toContain('commanders-orders');
	});

	it('returns every pool when no groups are named', async () => {
		const held = picking(
			'commanders-orders',
			2,
			picking('combat-tactics', 2),
			picking('weapon-mastery', 1),
		);

		const all = await collectSwappableOptions(index, 'commander', 12, held, null);
		const narrowed = await collectSwappableOptions(
			index,
			'commander',
			12,
			held,
			new Set(['commanders-orders']),
		);

		expect(all.length).toBeGreaterThan(narrowed.length);
	});

	it('returns nothing for a level below the first offer', async () => {
		const pools = await collectSwappableOptions(
			index,
			'berserker',
			3,
			picking('savage-arsenal', 1),
			null,
		);

		expect(findPool(pools, 'savage-arsenal')).toBeUndefined();
	});

	it('returns nothing without a class', async () => {
		expect(await collectSwappableOptions(index, '', 10, new Map(), null)).toEqual([]);
	});

	it('sorts pools by the level they first appear at', async () => {
		const held = picking(
			'commanders-orders',
			2,
			picking('combat-tactics', 2),
			picking('weapon-mastery', 2),
		);

		const pools = await collectSwappableOptions(index, 'commander', 16, held, null);
		const firstLevels = pools.map((pool) => pool.levels[0]);

		expect(firstLevels).toEqual([...firstLevels].sort((a, b) => a - b));
	});
});
