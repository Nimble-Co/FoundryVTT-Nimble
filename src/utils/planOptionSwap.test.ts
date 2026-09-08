import { describe, expect, it } from 'vitest';

import type { SwappableOptionPool } from './collectSwappableOptions.ts';
import planOptionSwap from './planOptionSwap.ts';

function pool(overrides: Partial<SwappableOptionPool> = {}): SwappableOptionPool {
	return {
		poolKey: 'savage-arsenal',
		poolGroups: ['savage-arsenal'],
		displayName: 'Savage Arsenal',
		optionLabel: 'Choose a Savage Arsenal Ability',
		levels: [4, 6],
		pickCount: 2,
		candidateUuids: ['uuid:rampage', 'uuid:whirlwind', 'uuid:death-blow', 'uuid:swift-fury'],
		pickIdsByUuid: new Map([
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
		pickCount: 3,
		candidateUuids: ['uuid:tactic-a', 'uuid:tactic-b', 'uuid:die'],
		pickIdsByUuid: new Map([
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

const empty = { deleteItemIds: [], grants: [], changedPoolKeys: [], refusedPoolKeys: [] };

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

	it('ignores a selection with fewer picks than the character holds', () => {
		// Deselecting a pick to browse the pool must never cost the player that option.
		const plan = planOptionSwap([pool()], new Map([['savage-arsenal', ['uuid:rampage']]]), history);

		expect(plan).toEqual(empty);
	});

	it('ignores a selection with more picks than the character holds', () => {
		const plan = planOptionSwap(
			[pool()],
			new Map([['savage-arsenal', ['uuid:rampage', 'uuid:whirlwind', 'uuid:death-blow']]]),
			history,
		);

		expect(plan.changedPoolKeys).toEqual([]);
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

	it('releases the oldest pick first, so the most recent one survives', () => {
		const plan = planOptionSwap(
			[diePool()],
			new Map([['combat-tactics', ['uuid:die', 'uuid:tactic-a', 'uuid:tactic-b']]]),
			dieHistory,
		);

		expect(plan.deleteItemIds).toEqual(['item-die-6']);
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

	it('refuses a pool whose released pick no history entry holds', () => {
		// The history was rewritten between the offer and the rest, so the pick id is stale.
		// Creating a replacement no level records is the one state the swap must never make.
		const plan = planOptionSwap(
			[pool()],
			new Map([['savage-arsenal', ['uuid:rampage', 'uuid:death-blow']]]),
			[{ grantedFeatureIds: ['item-rampage'] }],
		);

		expect(plan).toEqual({ ...empty, refusedPoolKeys: ['savage-arsenal'] });
	});

	it('refuses only the stale pool and plans the rest', () => {
		const plan = planOptionSwap(
			[pool(), diePool()],
			new Map([
				['savage-arsenal', ['uuid:rampage', 'uuid:death-blow']],
				['combat-tactics', ['uuid:tactic-a', 'uuid:die', 'uuid:tactic-b']],
			]),
			[{ grantedFeatureIds: ['item-rampage'] }, ...dieHistory],
		);

		expect(plan.refusedPoolKeys).toEqual(['savage-arsenal']);
		expect(plan.changedPoolKeys).toEqual(['combat-tactics']);
		expect(plan.deleteItemIds).toEqual(['item-die-6']);
	});

	it('plans each pool independently', () => {
		const tactics = pool({
			poolKey: 'combat-tactics',
			poolGroups: ['combat-tactics'],
			candidateUuids: ['uuid:tactic-a', 'uuid:tactic-b'],
			pickIdsByUuid: new Map([['uuid:tactic-a', ['item-tactic-a']]]),
			pickCount: 1,
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
