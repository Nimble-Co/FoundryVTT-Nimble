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

function makeActor(rollData: Record<string, unknown> = {}): CharacterActorLike {
	return {
		type: 'character',
		getRollData: vi.fn(() => rollData),
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

describe('applyRefillTriggersToPools — @poolMax / @poolCurrent tokens', () => {
	it('resolves @poolMax to the pool max for set mode (Oathsworn L14 scaling)', async () => {
		const actor = makeActor();
		const pools: DicePoolMap = {
			judgment: makePool({
				max: 3,
				faces: [],
				refills: [refill({ trigger: 'onAttacked', mode: 'set', value: '@poolMax' })],
			}),
		};

		const { nextPools } = await applyRefillTriggersToPools(actor, pools, ['onAttacked']);

		expect(nextPools.judgment.faces).toHaveLength(3);
	});

	it('resolves @poolMax against the per-pool max — Oathsworn L1 still gets 2 dice', async () => {
		const actor = makeActor();
		const pools: DicePoolMap = {
			judgment: makePool({
				max: 2,
				faces: [],
				refills: [refill({ trigger: 'onAttacked', mode: 'set', value: '@poolMax' })],
			}),
		};

		const { nextPools } = await applyRefillTriggersToPools(actor, pools, ['onAttacked']);

		expect(nextPools.judgment.faces).toHaveLength(2);
	});

	it('supports arithmetic on @poolMax (e.g. "@poolMax - 1")', async () => {
		const actor = makeActor();
		const pools: DicePoolMap = {
			judgment: makePool({
				max: 3,
				faces: [],
				refills: [refill({ trigger: 'safeRest', mode: 'set', value: '@poolMax - 1' })],
			}),
		};

		const { nextPools } = await applyRefillTriggersToPools(actor, pools, ['safeRest']);

		expect(nextPools.judgment.faces).toHaveLength(2);
	});

	it('resolves @poolCurrent to the current face count', async () => {
		const actor = makeActor();
		const pools: DicePoolMap = {
			judgment: makePool({
				max: 5,
				faces: [4, 5],
				refills: [refill({ trigger: 'safeRest', mode: 'add', value: '@poolCurrent' })],
			}),
		};

		const { nextPools } = await applyRefillTriggersToPools(actor, pools, ['safeRest']);

		// add mode rolls min(@poolCurrent=2, room=3) = 2 new dice -> 4 total faces.
		expect(nextPools.judgment.faces).toHaveLength(4);
	});

	it('mixes pool tokens with actor rollData references', async () => {
		const actor = makeActor({ level: 5 });
		const pools: DicePoolMap = {
			judgment: makePool({
				max: 10,
				faces: [],
				refills: [refill({ trigger: 'safeRest', mode: 'set', value: '@poolMax - @level' })],
			}),
		};

		const { nextPools } = await applyRefillTriggersToPools(actor, pools, ['safeRest']);

		expect(nextPools.judgment.faces).toHaveLength(5);
	});

	it('leaves plain numeric refill values untouched (regression)', async () => {
		const actor = makeActor();
		const pools: DicePoolMap = {
			judgment: makePool({
				max: 5,
				faces: [],
				refills: [refill({ trigger: 'onAttacked', mode: 'set', value: '2' })],
			}),
		};

		const { nextPools } = await applyRefillTriggersToPools(actor, pools, ['onAttacked']);

		expect(nextPools.judgment.faces).toHaveLength(2);
	});
});
