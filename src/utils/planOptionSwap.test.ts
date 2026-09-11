import { describe, expect, it } from 'vitest';

import type { SwappableOptionPool } from './collectSwappableOptions.ts';
import planOptionSwap, { isSelectionApplicable } from './planOptionSwap.ts';

function pool(overrides: Partial<SwappableOptionPool> = {}): SwappableOptionPool {
	const heldCount = overrides.heldCount ?? 2;
	return {
		poolKey: 'savage-arsenal',
		poolGroups: ['savage-arsenal'],
		displayName: 'Savage Arsenal',
		optionLabel: 'Choose a Savage Arsenal Ability',
		levels: [4, 6],
		heldCount,
		// The levels grant what the character holds unless a case says otherwise.
		grantedCount: heldCount,
		slots: [],
		candidateUuids: ['uuid:rampage', 'uuid:whirlwind', 'uuid:death-blow', 'uuid:swift-fury'],
		heldIdsByUuid: new Map([
			['uuid:rampage', ['item-rampage']],
			['uuid:whirlwind', ['item-whirlwind']],
		]),
		repeatableUuids: [],
		...overrides,
	};
}

/** A Commander pool: one tactic at level 4, the die at levels 6 and 8. */
function diePool(overrides: Partial<SwappableOptionPool> = {}): SwappableOptionPool {
	return pool({
		poolKey: 'combat-tactics',
		poolGroups: ['combat-tactics'],
		displayName: 'Fit for Any Battlefield',
		levels: [4, 6, 8],
		heldCount: 3,
		candidateUuids: ['uuid:tactic-a', 'uuid:tactic-b', 'uuid:die'],
		heldIdsByUuid: new Map([
			['uuid:tactic-a', ['item-tactic-a']],
			['uuid:die', ['item-die-6', 'item-die-8']],
		]),
		repeatableUuids: ['uuid:die'],
		...overrides,
	});
}

/** Level 4 granted Rampage, level 6 granted Whirlwind. */
const history = [
	{ grantedFeatureIds: ['item-other', 'item-rampage'] },
	{ grantedFeatureIds: ['item-whirlwind'] },
];

/** Level 4 granted a tactic, levels 6 and 8 a die each. */
const dieHistory = [
	{ grantedFeatureIds: ['item-tactic-a'] },
	{ grantedFeatureIds: ['item-die-6'] },
	{ grantedFeatureIds: ['item-die-8'] },
];

const empty = { deleteItemIds: [], grants: [], changedPoolKeys: [] };

describe('planOptionSwap', () => {
	it('plans nothing when the selection matches the picks', () => {
		const plan = planOptionSwap(
			[pool()],
			new Map([['savage-arsenal', ['uuid:rampage', 'uuid:whirlwind']]]),
			history,
		);

		expect(plan).toEqual(empty);
	});

	it('plans nothing for a pool the player did not touch', () => {
		const plan = planOptionSwap([pool()], new Map(), history);

		expect(plan.changedPoolKeys).toEqual([]);
	});

	it('ignores the order the selection arrives in', () => {
		const plan = planOptionSwap(
			[pool()],
			new Map([['savage-arsenal', ['uuid:whirlwind', 'uuid:rampage']]]),
			history,
		);

		expect(plan.changedPoolKeys).toEqual([]);
	});

	it('deletes the dropped pick and grants the new one', () => {
		const plan = planOptionSwap(
			[pool()],
			new Map([['savage-arsenal', ['uuid:rampage', 'uuid:death-blow']]]),
			history,
		);

		expect(plan.deleteItemIds).toEqual(['item-whirlwind']);
		expect(plan.grants.map((grant) => grant.uuid)).toEqual(['uuid:death-blow']);
	});

	it('gives the replacement the history entry of the pick it replaces', () => {
		// Whirlwind was granted at level 6, which is history index 1.
		const plan = planOptionSwap(
			[pool()],
			new Map([['savage-arsenal', ['uuid:rampage', 'uuid:death-blow']]]),
			history,
		);

		expect(plan.grants[0].historyIndex).toBe(1);
	});

	it('pairs several swaps to the entries they came from', () => {
		const plan = planOptionSwap(
			[pool()],
			new Map([['savage-arsenal', ['uuid:death-blow', 'uuid:swift-fury']]]),
			history,
		);

		expect(plan.deleteItemIds).toEqual(['item-rampage', 'item-whirlwind']);
		expect(plan.grants).toEqual([
			{ uuid: 'uuid:death-blow', historyIndex: 0 },
			{ uuid: 'uuid:swift-fury', historyIndex: 1 },
		]);
	});

	it('fills a shortfall by granting the extra pick and releasing nothing', () => {
		const short = pool({
			heldCount: 1,
			grantedCount: 2,
			heldIdsByUuid: new Map([['uuid:rampage', ['item-rampage']]]),
		});

		const plan = planOptionSwap(
			[short],
			new Map([['savage-arsenal', ['uuid:rampage', 'uuid:death-blow']]]),
			history,
		);

		expect(plan.deleteItemIds).toEqual([]);
		expect(plan.grants).toEqual([{ uuid: 'uuid:death-blow', historyIndex: -1 }]);
		expect(plan.changedPoolKeys).toEqual(['savage-arsenal']);
	});

	it('ignores a selection with fewer picks than the character holds', () => {
		// Deselecting a pick to browse the pool must never cost the player that option, and a
		// pool that is short of its grant is no exception.
		const plan = planOptionSwap(
			[pool({ grantedCount: 3 })],
			new Map([['savage-arsenal', ['uuid:rampage']]]),
			history,
		);

		expect(plan).toEqual(empty);
	});

	it('ignores a selection with more picks than the levels grant', () => {
		// Two held against two granted, so a third entry is past the grant and is not a fill.
		const plan = planOptionSwap(
			[pool()],
			new Map([['savage-arsenal', ['uuid:rampage', 'uuid:whirlwind', 'uuid:death-blow']]]),
			history,
		);

		expect(plan).toEqual(empty);
	});

	it('applies a trade even when the character holds more than the levels grant', () => {
		// Six held against five granted. Trading never makes the excess worse, so it is allowed.
		const excess = pool({
			heldCount: 6,
			grantedCount: 5,
			heldIdsByUuid: new Map([
				['uuid:rampage', ['item-rampage']],
				['uuid:whirlwind', ['item-whirlwind']],
				['uuid:death-blow', ['item-death-blow-a', 'item-death-blow-b']],
				['uuid:swift-fury', ['item-swift-fury-a', 'item-swift-fury-b']],
			]),
		});

		const plan = planOptionSwap(
			[excess],
			new Map([
				[
					'savage-arsenal',
					[
						'uuid:rampage',
						'uuid:rampage',
						'uuid:whirlwind',
						'uuid:death-blow',
						'uuid:swift-fury',
						'uuid:swift-fury',
					],
				],
			]),
			[{ grantedFeatureIds: ['item-death-blow-a'] }],
		);

		expect(plan.deleteItemIds).toEqual(['item-death-blow-a']);
		expect(plan.grants).toEqual([{ uuid: 'uuid:rampage', historyIndex: 0 }]);
		expect(plan.changedPoolKeys).toEqual(['savage-arsenal']);
	});

	it('ignores a selection that repeats a pick past the pool total', () => {
		// Two dice and two tactics is four picks against three.
		const plan = planOptionSwap(
			[diePool()],
			new Map([['combat-tactics', ['uuid:tactic-a', 'uuid:tactic-b', 'uuid:die', 'uuid:die']]]),
			dieHistory,
		);

		expect(plan.changedPoolKeys).toEqual([]);
	});

	it('reports which pools changed', () => {
		const plan = planOptionSwap(
			[pool()],
			new Map([['savage-arsenal', ['uuid:rampage', 'uuid:death-blow']]]),
			history,
		);

		expect(plan.changedPoolKeys).toEqual(['savage-arsenal']);
	});

	it('releases one pick of a repeated option and leaves the rest', () => {
		const plan = planOptionSwap(
			[diePool()],
			new Map([['combat-tactics', ['uuid:tactic-a', 'uuid:die', 'uuid:tactic-b']]]),
			dieHistory,
		);

		expect(plan.deleteItemIds).toEqual(['item-die-6']);
		expect(plan.grants).toEqual([{ uuid: 'uuid:tactic-b', historyIndex: 1 }]);
	});

	it('releases from the front of the held list, so a tracked copy leaves before an untracked one', () => {
		// The holdings put the ids an entry names first, so the front of the list is the copy
		// whose entry a replacement can inherit.
		const mixed = diePool({
			heldIdsByUuid: new Map([
				['uuid:tactic-a', ['item-tactic-a']],
				['uuid:die', ['item-die-tracked', 'item-die-untracked']],
			]),
		});

		const plan = planOptionSwap(
			[mixed],
			new Map([['combat-tactics', ['uuid:die', 'uuid:tactic-a', 'uuid:tactic-b']]]),
			[{ grantedFeatureIds: ['item-tactic-a'] }, { grantedFeatureIds: ['item-die-tracked'] }],
		);

		expect(plan.deleteItemIds).toEqual(['item-die-tracked']);
		expect(plan.grants).toEqual([{ uuid: 'uuid:tactic-b', historyIndex: 1 }]);
	});

	it('grants one more of a repeated option when its count rose', () => {
		const plan = planOptionSwap(
			[diePool()],
			new Map([['combat-tactics', ['uuid:die', 'uuid:die', 'uuid:die']]]),
			dieHistory,
		);

		expect(plan.deleteItemIds).toEqual(['item-tactic-a']);
		expect(plan.grants).toEqual([{ uuid: 'uuid:die', historyIndex: 0 }]);
	});

	it('releases every pick of an option whose count fell to zero', () => {
		const plan = planOptionSwap(
			[diePool()],
			new Map([['combat-tactics', ['uuid:tactic-a', 'uuid:tactic-b', 'uuid:tactic-b']]]),
			dieHistory,
		);

		expect(plan.deleteItemIds).toEqual(['item-die-6', 'item-die-8']);
		expect(plan.grants).toEqual([
			{ uuid: 'uuid:tactic-b', historyIndex: 1 },
			{ uuid: 'uuid:tactic-b', historyIndex: 2 },
		]);
	});

	it('records nowhere a replacement whose released pick no entry names', () => {
		// No entry names the pick that leaves, so its replacement is untracked, exactly like
		// the item it replaces. The swap still happens.
		const plan = planOptionSwap(
			[pool()],
			new Map([['savage-arsenal', ['uuid:rampage', 'uuid:death-blow']]]),
			[{ grantedFeatureIds: ['item-rampage'] }],
		);

		expect(plan.deleteItemIds).toEqual(['item-whirlwind']);
		expect(plan.grants).toEqual([{ uuid: 'uuid:death-blow', historyIndex: -1 }]);
		expect(plan.changedPoolKeys).toEqual(['savage-arsenal']);
	});

	it('plans a pool with an untracked release alongside a tracked one', () => {
		const plan = planOptionSwap(
			[pool(), diePool()],
			new Map([
				['savage-arsenal', ['uuid:rampage', 'uuid:death-blow']],
				['combat-tactics', ['uuid:tactic-a', 'uuid:die', 'uuid:tactic-b']],
			]),
			[{ grantedFeatureIds: ['item-rampage'] }, ...dieHistory],
		);

		expect(plan.changedPoolKeys).toEqual(['savage-arsenal', 'combat-tactics']);
		expect(plan.deleteItemIds).toEqual(['item-whirlwind', 'item-die-6']);
		expect(plan.grants).toEqual([
			{ uuid: 'uuid:death-blow', historyIndex: -1 },
			{ uuid: 'uuid:tactic-b', historyIndex: 2 },
		]);
	});

	it('plans each pool independently', () => {
		const tactics = pool({
			poolKey: 'combat-tactics',
			poolGroups: ['combat-tactics'],
			candidateUuids: ['uuid:tactic-a', 'uuid:tactic-b'],
			heldIdsByUuid: new Map([['uuid:tactic-a', ['item-tactic-a']]]),
			heldCount: 1,
		});

		const plan = planOptionSwap(
			[pool(), tactics],
			new Map([
				['savage-arsenal', ['uuid:rampage', 'uuid:death-blow']],
				['combat-tactics', ['uuid:tactic-b']],
			]),
			[...history, { grantedFeatureIds: ['item-tactic-a'] }],
		);

		expect(plan.deleteItemIds).toEqual(['item-whirlwind', 'item-tactic-a']);
		expect(plan.changedPoolKeys).toEqual(['savage-arsenal', 'combat-tactics']);
	});
});

describe('isSelectionApplicable', () => {
	it('applies a selection that matches the holdings', () => {
		expect(isSelectionApplicable(2, 2, 2)).toBe(true);
	});

	it('refuses a selection past a grant the holdings already meet', () => {
		expect(isSelectionApplicable(3, 2, 2)).toBe(false);
	});

	it('refuses a selection below the holdings', () => {
		expect(isSelectionApplicable(1, 2, 2)).toBe(false);
	});

	it('applies a fill up to the grant', () => {
		expect(isSelectionApplicable(2, 1, 2)).toBe(true);
	});

	it('refuses a fill past the grant', () => {
		expect(isSelectionApplicable(3, 1, 2)).toBe(false);
	});

	it('applies a trade above the grant', () => {
		expect(isSelectionApplicable(6, 6, 5)).toBe(true);
	});

	it('refuses a selection below holdings that are above the grant', () => {
		expect(isSelectionApplicable(5, 6, 5)).toBe(false);
	});
});
