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
		ownedUuids: ['uuid:rampage', 'uuid:whirlwind'],
		...overrides,
	};
}

const itemIds = new Map([
	['uuid:rampage', 'item-rampage'],
	['uuid:whirlwind', 'item-whirlwind'],
]);

/** Level 4 granted Rampage, level 6 granted Whirlwind. */
const history = [
	{ grantedFeatureIds: ['item-other', 'item-rampage'] },
	{ grantedFeatureIds: ['item-whirlwind'] },
];

describe('planOptionSwap', () => {
	it('plans nothing when the selection matches what is owned', () => {
		const plan = planOptionSwap(
			[pool()],
			new Map([['savage-arsenal', ['uuid:rampage', 'uuid:whirlwind']]]),
			itemIds,
			history,
		);

		expect(plan).toEqual({ deleteItemIds: [], grants: [], changedPoolKeys: [] });
	});

	it('plans nothing for a pool the player did not touch', () => {
		const plan = planOptionSwap([pool()], new Map(), itemIds, history);

		expect(plan.changedPoolKeys).toEqual([]);
	});

	it('ignores the order the selection arrives in', () => {
		const plan = planOptionSwap(
			[pool()],
			new Map([['savage-arsenal', ['uuid:whirlwind', 'uuid:rampage']]]),
			itemIds,
			history,
		);

		expect(plan.changedPoolKeys).toEqual([]);
	});

	it('deletes the dropped pick and grants the new one', () => {
		const plan = planOptionSwap(
			[pool()],
			new Map([['savage-arsenal', ['uuid:rampage', 'uuid:death-blow']]]),
			itemIds,
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
			itemIds,
			history,
		);

		expect(plan.grants[0].historyIndex).toBe(1);
	});

	it('pairs several swaps to the entries they came from', () => {
		const plan = planOptionSwap(
			[pool()],
			new Map([['savage-arsenal', ['uuid:death-blow', 'uuid:swift-fury']]]),
			itemIds,
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
		const plan = planOptionSwap(
			[pool()],
			new Map([['savage-arsenal', ['uuid:rampage']]]),
			itemIds,
			history,
		);

		expect(plan).toEqual({ deleteItemIds: [], grants: [], changedPoolKeys: [] });
	});

	it('ignores a selection with more picks than the character holds', () => {
		const plan = planOptionSwap(
			[pool()],
			new Map([['savage-arsenal', ['uuid:rampage', 'uuid:whirlwind', 'uuid:death-blow']]]),
			itemIds,
			history,
		);

		expect(plan.changedPoolKeys).toEqual([]);
	});

	it('reports which pools changed', () => {
		const plan = planOptionSwap(
			[pool()],
			new Map([['savage-arsenal', ['uuid:rampage', 'uuid:death-blow']]]),
			itemIds,
			history,
		);

		expect(plan.changedPoolKeys).toEqual(['savage-arsenal']);
	});

	it('falls back to the latest entry holding the pool when a pick is untracked', () => {
		// An item the character owns that no history entry records — a hand-dropped pick, or one
		// from a level that predates the history.
		const plan = planOptionSwap(
			[pool({ ownedUuids: ['uuid:rampage', 'uuid:whirlwind'] })],
			new Map([['savage-arsenal', ['uuid:whirlwind', 'uuid:death-blow']]]),
			itemIds,
			[{ grantedFeatureIds: ['item-whirlwind'] }],
		);

		expect(plan.deleteItemIds).toEqual(['item-rampage']);
		expect(plan.grants[0].historyIndex).toBe(0);
	});

	it('records no entry when the pool appears nowhere in history', () => {
		const plan = planOptionSwap(
			[pool()],
			new Map([['savage-arsenal', ['uuid:rampage', 'uuid:death-blow']]]),
			itemIds,
			[{ grantedFeatureIds: ['item-unrelated'] }],
		);

		expect(plan.grants[0].historyIndex).toBe(-1);
	});

	it('skips a dropped pick whose item cannot be resolved', () => {
		const plan = planOptionSwap(
			[pool({ ownedUuids: ['uuid:rampage', 'uuid:ghost'] })],
			new Map([['savage-arsenal', ['uuid:rampage', 'uuid:death-blow']]]),
			itemIds,
			history,
		);

		expect(plan.deleteItemIds).toEqual([]);
		expect(plan.grants.map((grant) => grant.uuid)).toEqual(['uuid:death-blow']);
	});

	it('plans each pool independently', () => {
		const tactics = pool({
			poolKey: 'combat-tactics',
			poolGroups: ['combat-tactics'],
			candidateUuids: ['uuid:tactic-a', 'uuid:tactic-b'],
			ownedUuids: ['uuid:tactic-a'],
			pickCount: 1,
		});
		const ids = new Map([...itemIds, ['uuid:tactic-a', 'item-tactic-a']]);

		const plan = planOptionSwap(
			[pool(), tactics],
			new Map([
				['savage-arsenal', ['uuid:rampage', 'uuid:death-blow']],
				['combat-tactics', ['uuid:tactic-b']],
			]),
			ids,
			[...history, { grantedFeatureIds: ['item-tactic-a'] }],
		);

		expect(plan.deleteItemIds).toEqual(['item-whirlwind', 'item-tactic-a']);
		expect(plan.changedPoolKeys).toEqual(['savage-arsenal', 'combat-tactics']);
	});
});
