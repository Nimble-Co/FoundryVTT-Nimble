import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyRefillTriggersToPools } from './dicePoolRefill.js';
import type { CharacterActorLike, DicePoolMap, DicePoolState, DiceRefillEntry } from './types.js';

// The shared Foundry Die mock in tests/mocks/foundry.ts doesn't implement
// evaluate(), which rollSingleDieFace() in helpers.ts calls. Patch the Die
// constructor for this suite so it produces a deterministic face value.
beforeEach(() => {
	class DeterministicDie {
		faces: number;
		total: number;
		constructor({ faces }: { faces: number }) {
			this.faces = faces;
			this.total = faces;
		}
		async evaluate(): Promise<void> {}
	}
	(
		globalThis as unknown as { foundry: { dice: { terms: { Die: unknown } } } }
	).foundry.dice.terms.Die = DeterministicDie;
});

function makeActor(): CharacterActorLike {
	return {
		type: 'character',
		getRollData: vi.fn(() => ({})),
	} as unknown as CharacterActorLike;
}

function makePool(overrides: Partial<DicePoolState> = {}): DicePoolState {
	return {
		id: 'judgment',
		identifier: 'judgment',
		scope: 'item',
		sourceItemId: 'item-1',
		sourceItemName: 'Radiant Judgment',
		label: 'Judgment Dice',
		dieSize: 'd6',
		max: 2,
		faces: [],
		refills: [],
		consumption: 'manual',
		bonusOnAttackDelivery: null,
		...overrides,
	};
}

function refill(
	entry: Partial<DiceRefillEntry> & Pick<DiceRefillEntry, 'trigger'>,
): DiceRefillEntry {
	return {
		mode: 'add',
		value: '1',
		...entry,
	} as DiceRefillEntry;
}

describe('applyRefillTriggersToPools — setIfEmpty mode', () => {
	it('rolls fresh dice up to `value` when the pool is empty', async () => {
		const actor = makeActor();
		const pools: DicePoolMap = {
			judgment: makePool({
				faces: [],
				refills: [refill({ trigger: 'onAttacked', mode: 'setIfEmpty', value: '2' })],
			}),
		};

		const { nextPools, entries } = await applyRefillTriggersToPools(actor, pools, ['onAttacked']);

		expect(nextPools.judgment.faces).toHaveLength(2);
		expect(entries).toHaveLength(1);
		expect(entries[0].rolledFaces).toHaveLength(2);
		expect(entries[0].previousFaces).toEqual([]);
	});

	it('is a no-op when the pool already has live dice', async () => {
		const actor = makeActor();
		const pools: DicePoolMap = {
			judgment: makePool({
				faces: [5],
				refills: [refill({ trigger: 'onAttacked', mode: 'setIfEmpty', value: '2' })],
			}),
		};

		const { nextPools, entries } = await applyRefillTriggersToPools(actor, pools, ['onAttacked']);

		expect(nextPools.judgment.faces).toEqual([5]);
		expect(entries).toEqual([]);
	});

	it('is a no-op even when the pool is below max but non-empty', async () => {
		const actor = makeActor();
		const pools: DicePoolMap = {
			judgment: makePool({
				max: 3,
				faces: [4],
				refills: [refill({ trigger: 'onAttacked', mode: 'setIfEmpty', value: '3' })],
			}),
		};

		const { nextPools, entries } = await applyRefillTriggersToPools(actor, pools, ['onAttacked']);

		expect(nextPools.judgment.faces).toEqual([4]);
		expect(entries).toEqual([]);
	});

	it('clamps the roll count to pool.max', async () => {
		const actor = makeActor();
		const pools: DicePoolMap = {
			judgment: makePool({
				max: 2,
				faces: [],
				refills: [refill({ trigger: 'onAttacked', mode: 'setIfEmpty', value: '99' })],
			}),
		};

		const { nextPools, entries } = await applyRefillTriggersToPools(actor, pools, ['onAttacked']);

		expect(nextPools.judgment.faces).toHaveLength(2);
		expect(entries[0].rolledFaces).toHaveLength(2);
	});

	it('does not fire when the trigger does not match', async () => {
		const actor = makeActor();
		const pools: DicePoolMap = {
			judgment: makePool({
				faces: [],
				refills: [refill({ trigger: 'onAttacked', mode: 'setIfEmpty', value: '2' })],
			}),
		};

		const { nextPools, entries } = await applyRefillTriggersToPools(actor, pools, ['safeRest']);

		expect(nextPools.judgment.faces).toEqual([]);
		expect(entries).toEqual([]);
	});

	it('does not affect other modes on the same pool', async () => {
		const actor = makeActor();
		const pools: DicePoolMap = {
			fury: makePool({
				id: 'fury',
				identifier: 'fury',
				label: 'Fury Dice',
				max: 4,
				faces: [3, 3],
				refills: [refill({ trigger: 'safeRest', mode: 'refresh' })],
			}),
		};

		const { nextPools, entries } = await applyRefillTriggersToPools(actor, pools, ['safeRest']);

		expect(nextPools.fury.faces).toHaveLength(4);
		expect(entries).toHaveLength(1);
	});
});
