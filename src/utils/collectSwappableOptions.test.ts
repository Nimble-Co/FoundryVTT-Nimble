import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
	buildRealIndex,
	loadAllFeatureDocs,
	restoreMocks,
} from '../../tests/fixtures/classProgression.ts';
import type { HeldFeature, HeldPickHistoryEntry } from './collectHeldPicks.ts';
import collectSwappableOptions from './collectSwappableOptions.ts';
import type { ClassFeatureIndex } from './getClassFeatures.ts';

/**
 * Drives the real compendium, so the pools and held counts asserted here are the ones the
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

const NO_HISTORY: HeldPickHistoryEntry[] = [];

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

/** One feature item on the sheet, sourced from `uuid`. */
function feature(uuid: string, id: string): HeldFeature {
	return { id, compendiumSource: uuid };
}

/** One item of each of the first `count` members of a pool, plus any further items given. */
function holding(group: string, count: number, ...more: HeldFeature[][]): HeldFeature[] {
	return [
		...poolMembers(group)
			.slice(0, count)
			.map((uuid, position) => feature(uuid, `${group}-${position}`)),
		...more.flat(),
	];
}

describe('collectSwappableOptions', () => {
	it('finds a pool whose offer level is not the current level', async () => {
		// The Hunter's Thrill of the Hunt is offered at 2, 4, 6, 8, 12 and 14, never at 10.
		// Asking the resolver about level 10 alone returns nothing, which is the whole reason
		// this replays the levels below.
		const pools = await collectSwappableOptions(
			index,
			'hunter',
			10,
			holding('thrill-of-the-hunt', 5),
			NO_HISTORY,
			null,
		);

		expect(findPool(pools, 'thrill-of-the-hunt')).toBeDefined();
	});

	it('counts the items the sheet holds, not the picks the levels grant', async () => {
		const pools = await collectSwappableOptions(
			index,
			'hunter',
			10,
			holding('thrill-of-the-hunt', 3),
			NO_HISTORY,
			null,
		);

		expect(findPool(pools, 'thrill-of-the-hunt')?.heldCount).toBe(3);
	});

	it('counts a pool whose levels offer a choice between options', async () => {
		// The Commander's level 6, 8, 10, 12 and 16 each offer a Combat Ability OR a max Combat
		// Die, and which was taken is recorded nowhere, so the levels tell us nothing. What the
		// sheet holds is what is counted.
		const pools = await collectSwappableOptions(
			index,
			'commander',
			16,
			holding('combat-tactics', 5),
			NO_HISTORY,
			null,
		);

		expect(findPool(pools, 'combat-tactics')?.heldCount).toBe(5);
	});

	it('offers an item an alternative grants outright as a member of the pool', async () => {
		// The Commander may take +1 max Combat Die instead of a Combat Ability, and the die is
		// a granted item rather than a pool member. It has to be tradeable both ways.
		const pools = await collectSwappableOptions(
			index,
			'commander',
			16,
			holding('combat-tactics', 2),
			NO_HISTORY,
			null,
		);

		expect(findPool(pools, 'combat-tactics')?.candidateUuids).toContain(DIE);
	});

	it('counts a granted item held once as one of the picks', async () => {
		const pools = await collectSwappableOptions(
			index,
			'commander',
			16,
			holding('combat-tactics', 2, [feature(DIE, 'die-6')]),
			NO_HISTORY,
			null,
		);

		const pool = findPool(pools, 'combat-tactics');
		expect(pool?.heldIdsByUuid.get(DIE)).toEqual(['die-6']);
		expect(pool?.heldCount).toBe(3);
	});

	it('counts two items with one source as two picks', async () => {
		const pools = await collectSwappableOptions(
			index,
			'commander',
			16,
			holding('combat-tactics', 2, [feature(DIE, 'die-6'), feature(DIE, 'die-8')]),
			NO_HISTORY,
			null,
		);

		const pool = findPool(pools, 'combat-tactics');
		expect(pool?.heldIdsByUuid.get(DIE)).toEqual(['die-6', 'die-8']);
		expect(pool?.heldCount).toBe(4);
	});

	it('keeps the held ids in the order the sheet lists them', async () => {
		const pools = await collectSwappableOptions(
			index,
			'commander',
			16,
			holding('combat-tactics', 1, [feature(DIE, 'die-8'), feature(DIE, 'die-6')]),
			NO_HISTORY,
			null,
		);

		expect(findPool(pools, 'combat-tactics')?.heldIdsByUuid.get(DIE)).toEqual(['die-8', 'die-6']);
	});

	it('orders the copies of a member with tracked ids first', async () => {
		// The second die is the one a level recorded, so it is the one a swap releases first
		// and the one whose entry a replacement can inherit.
		const pools = await collectSwappableOptions(
			index,
			'commander',
			16,
			holding('combat-tactics', 1, [feature(DIE, 'die-loose'), feature(DIE, 'die-tracked')]),
			[{ level: 6, grantedFeatureIds: ['die-tracked'] }],
			null,
		);

		expect(findPool(pools, 'combat-tactics')?.heldIdsByUuid.get(DIE)).toEqual([
			'die-tracked',
			'die-loose',
		]);
	});

	it('reports the right total for a mix of repeated and single picks', async () => {
		const [first, second, third] = poolMembers('combat-tactics');

		const pools = await collectSwappableOptions(
			index,
			'commander',
			16,
			[
				feature(first, 'a'),
				feature(second, 'b'),
				feature(DIE, 'die-6'),
				feature(DIE, 'die-8'),
				feature(third, 'c'),
			],
			NO_HISTORY,
			null,
		);

		const pool = findPool(pools, 'combat-tactics');
		expect(pool?.heldCount).toBe(5);
		expect([...pool!.heldIdsByUuid.keys()]).toEqual(
			expect.arrayContaining([first, second, third, DIE]),
		);
	});

	it('leaves a member the character holds none of out of the holdings but in the candidates', async () => {
		const [first, second] = poolMembers('combat-tactics');

		const pools = await collectSwappableOptions(
			index,
			'commander',
			16,
			[feature(first, 'a')],
			NO_HISTORY,
			null,
		);

		const pool = findPool(pools, 'combat-tactics');
		expect(pool?.heldIdsByUuid.has(second)).toBe(false);
		expect(pool?.candidateUuids).toContain(second);
	});

	it('ignores an item with no compendium source', async () => {
		const [first] = poolMembers('combat-tactics');

		const pools = await collectSwappableOptions(
			index,
			'commander',
			16,
			[feature(first, 'a'), { id: 'homebrew', compendiumSource: null }],
			NO_HISTORY,
			null,
		);

		expect(findPool(pools, 'combat-tactics')?.heldCount).toBe(1);
	});

	it('keeps a pool the character holds no member of, so it can be filled', async () => {
		const pools = await collectSwappableOptions(
			index,
			'commander',
			16,
			holding('commanders-orders', 2),
			NO_HISTORY,
			null,
		);

		const pool = findPool(pools, 'weapon-mastery');
		expect(pool?.heldCount).toBe(0);
		expect(pool?.heldIdsByUuid.size).toBe(0);
	});

	it('matches a pick stored under the other system id to the same member', async () => {
		// A character exported from one install and imported into the other carries the
		// source under the other namespace. Under a raw comparison the die would go uncounted.
		const stored = DIE.replace('Compendium.nimble.', 'Compendium.nimble-dev.');

		const pools = await collectSwappableOptions(
			index,
			'commander',
			16,
			holding('combat-tactics', 1, [feature(stored, 'die-6')]),
			NO_HISTORY,
			null,
		);

		const pool = findPool(pools, 'combat-tactics');
		expect(pool?.heldIdsByUuid.get(DIE)).toEqual(['die-6']);
		expect(pool?.heldCount).toBe(2);
	});

	it('marks a member repeatable when its grant allows a duplicate', async () => {
		const [tactic] = poolMembers('combat-tactics');

		const pools = await collectSwappableOptions(
			index,
			'commander',
			16,
			holding('combat-tactics', 1),
			NO_HISTORY,
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
			holding('savage-arsenal', 2),
			NO_HISTORY,
			null,
		);

		expect(findPool(pools, 'savage-arsenal')?.repeatableUuids).toEqual([]);
	});

	it('merges pools that share a group, so no pick counts twice', async () => {
		// A Combat Ability may come from either Commander pool, so the two pools are one.
		const held = holding('commanders-orders', 2, holding('combat-tactics', 2));

		const pools = await collectSwappableOptions(index, 'commander', 16, held, NO_HISTORY, null);
		const merged = findPool(pools, 'combat-tactics');

		expect(merged?.poolGroups).toEqual(['commanders-orders', 'combat-tactics']);
		expect(merged?.heldCount).toBe(4);
		expect(pools.filter((pool) => pool.poolGroups.includes('commanders-orders'))).toHaveLength(1);
	});

	it('titles a merged pool from its groups when no feature lends it a name', async () => {
		const doc = loadAllFeatureDocs().find((entry) => entry.name === 'Fit for Any Battlefield');
		if (!doc) throw new Error('fixture feature missing');
		const held = holding('commanders-orders', 2, holding('combat-tactics', 2));

		doc.name = '';
		try {
			const pools = await collectSwappableOptions(index, 'commander', 16, held, NO_HISTORY, null);
			expect(findPool(pools, 'combat-tactics')?.displayName).toBe(
				'Commanders Orders / Combat Tactics',
			);
		} finally {
			doc.name = 'Fit for Any Battlefield';
		}
	});

	it('keeps a narrowed pool to the groups the rule names', async () => {
		const held = holding('commanders-orders', 2, holding('combat-tactics', 2));

		const pools = await collectSwappableOptions(
			index,
			'commander',
			16,
			held,
			NO_HISTORY,
			new Set(['combat-tactics']),
		);

		expect(pools).toHaveLength(1);
		expect(pools[0].poolGroups).toEqual(['combat-tactics']);
		expect(pools[0].heldCount).toBe(2);
	});

	it('offers the whole pool, not just the members tied to one level', async () => {
		const pools = await collectSwappableOptions(
			index,
			'berserker',
			8,
			holding('savage-arsenal', 2),
			NO_HISTORY,
			null,
		);

		expect(findPool(pools, 'savage-arsenal')?.candidateUuids).toHaveLength(
			poolMembers('savage-arsenal').length,
		);
	});

	it('reports which members the character holds', async () => {
		const [first, second] = poolMembers('savage-arsenal');

		const pools = await collectSwappableOptions(
			index,
			'berserker',
			8,
			[feature(first, 'a'), feature(second, 'b')],
			NO_HISTORY,
			null,
		);

		expect([...findPool(pools, 'savage-arsenal')!.heldIdsByUuid.keys()]).toEqual([first, second]);
	});

	it('records the levels that offer the pool', async () => {
		const pools = await collectSwappableOptions(
			index,
			'hunter',
			8,
			holding('thrill-of-the-hunt', 4),
			NO_HISTORY,
			null,
		);

		expect(findPool(pools, 'thrill-of-the-hunt')?.levels).toEqual([2, 4, 6, 8]);
	});

	it('offers a pool the character holds nothing of, as one to fill', async () => {
		const pools = await collectSwappableOptions(index, 'berserker', 8, [], NO_HISTORY, null);

		const pool = findPool(pools, 'savage-arsenal');
		expect(pool?.heldCount).toBe(0);
		expect(pool?.grantedCount).toBeGreaterThan(0);
	});

	it('narrows to the pools a rule names', async () => {
		const held = holding('commanders-orders', 2, holding('combat-tactics', 2));

		const pools = await collectSwappableOptions(
			index,
			'commander',
			12,
			held,
			NO_HISTORY,
			new Set(['commanders-orders']),
		);

		expect(pools).toHaveLength(1);
		expect(pools[0].poolGroups).toContain('commanders-orders');
	});

	it('returns every pool when no groups are named', async () => {
		const held = holding(
			'commanders-orders',
			2,
			holding('combat-tactics', 2),
			holding('weapon-mastery', 1),
		);

		const all = await collectSwappableOptions(index, 'commander', 12, held, NO_HISTORY, null);
		const narrowed = await collectSwappableOptions(
			index,
			'commander',
			12,
			held,
			NO_HISTORY,
			new Set(['commanders-orders']),
		);

		expect(all.length).toBeGreaterThan(narrowed.length);
	});

	it('returns nothing for a level below the first offer', async () => {
		const pools = await collectSwappableOptions(
			index,
			'berserker',
			3,
			holding('savage-arsenal', 1),
			NO_HISTORY,
			null,
		);

		expect(findPool(pools, 'savage-arsenal')).toBeUndefined();
	});

	it('returns nothing without a class', async () => {
		expect(await collectSwappableOptions(index, '', 10, [], NO_HISTORY, null)).toEqual([]);
	});

	it('sorts pools by the level they first appear at', async () => {
		const held = holding(
			'commanders-orders',
			2,
			holding('combat-tactics', 2),
			holding('weapon-mastery', 2),
		);

		const pools = await collectSwappableOptions(index, 'commander', 16, held, NO_HISTORY, null);
		const firstLevels = pools.map((pool) => pool.levels[0]);

		expect(firstLevels).toEqual([...firstLevels].sort((a, b) => a - b));
	});
});
