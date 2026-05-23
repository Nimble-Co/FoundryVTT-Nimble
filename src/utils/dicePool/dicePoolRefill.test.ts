import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyRefillTriggersToPools } from './dicePoolRefill.js';
import { buildEffectiveDicePoolMap } from './helpers.js';
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

describe('applyRefillTriggersToPools — clear mode', () => {
	it('wipes all dice when the trigger matches', async () => {
		const actor = makeActor();
		const pools: DicePoolMap = {
			judgment: makePool({
				faces: [3, 5],
				refills: [refill({ trigger: 'encounterEnd', mode: 'clear' })],
			}),
		};

		const { nextPools, entries } = await applyRefillTriggersToPools(actor, pools, ['encounterEnd']);

		expect(nextPools.judgment.faces).toEqual([]);
		expect(entries).toHaveLength(1);
		expect(entries[0].previousFaces).toEqual([3, 5]);
		expect(entries[0].newFaces).toEqual([]);
		expect(entries[0].rolledFaces).toEqual([]);
	});

	it('is a no-op when the pool is already empty (no spurious event)', async () => {
		const actor = makeActor();
		const pools: DicePoolMap = {
			judgment: makePool({
				faces: [],
				refills: [refill({ trigger: 'encounterEnd', mode: 'clear' })],
			}),
		};

		const { nextPools, entries } = await applyRefillTriggersToPools(actor, pools, ['encounterEnd']);

		expect(nextPools.judgment.faces).toEqual([]);
		expect(entries).toEqual([]);
	});

	it('does not fire when the trigger does not match', async () => {
		const actor = makeActor();
		const pools: DicePoolMap = {
			judgment: makePool({
				faces: [4],
				refills: [refill({ trigger: 'encounterEnd', mode: 'clear' })],
			}),
		};

		const { nextPools, entries } = await applyRefillTriggersToPools(actor, pools, ['onAttacked']);

		expect(nextPools.judgment.faces).toEqual([4]);
		expect(entries).toEqual([]);
	});

	it('ignores the value field (clearing is unconditional)', async () => {
		const actor = makeActor();
		const pools: DicePoolMap = {
			judgment: makePool({
				faces: [2, 3],
				refills: [refill({ trigger: 'encounterEnd', mode: 'clear', value: '99' })],
			}),
		};

		const { nextPools } = await applyRefillTriggersToPools(actor, pools, ['encounterEnd']);

		expect(nextPools.judgment.faces).toEqual([]);
	});
});

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

// End-to-end check that the shape shipped in radiant-judgement.json plus the
// L14 modifyPool produces the rulebook-correct refill behavior.
describe('Oathsworn Radiant Judgement (post-Task-4 pack shape)', () => {
	type MockRule = { type: string; [key: string]: unknown };
	type MockItem = {
		id: string;
		name: string;
		rules: Map<string, MockRule>;
		flags: Record<string, Record<string, unknown>>;
	};

	function judgmentPoolRule(): MockRule {
		return {
			type: 'dicePool',
			id: 'judgment-pool-base',
			identifier: 'judgment',
			scope: 'item',
			dieSize: 'd6',
			max: '2',
			initial: 'zero',
			refills: [
				{ trigger: 'onAttacked', mode: 'setIfEmpty', value: '@poolMax' },
				{ trigger: 'encounterEnd', mode: 'clear', value: '0' },
			],
		};
	}

	function l14ModifyRule(): MockRule {
		return {
			type: 'modifyPool',
			id: 'judgment-plus1-l14',
			poolType: 'dice',
			poolIdentifier: 'judgment',
			maxDelta: '+1',
		};
	}

	function makeOathsworn(rules: MockRule[]): CharacterActorLike {
		const item: MockItem = {
			id: 'radiant-judgement',
			name: 'Radiant Judgement',
			rules: new Map(rules.map((rule, idx) => [String(idx), rule])),
			flags: {},
		};
		return {
			type: 'character',
			items: { contents: [item], get: () => item },
			flags: {},
			getRollData: vi.fn(() => ({})),
		} as unknown as CharacterActorLike;
	}

	it('L1 empty pool: onAttacked refills to 2 dice', async () => {
		const actor = makeOathsworn([judgmentPoolRule()]);
		const pools = buildEffectiveDicePoolMap(actor);
		expect(pools.judgment.max).toBe(2);

		const { nextPools } = await applyRefillTriggersToPools(actor, pools, ['onAttacked']);

		expect(nextPools.judgment.faces).toHaveLength(2);
	});

	it('L1 non-empty pool: onAttacked is a no-op (no double-set on repeat attacks)', async () => {
		const actor = makeOathsworn([judgmentPoolRule()]);
		const pools = buildEffectiveDicePoolMap(actor);
		pools.judgment.faces = [4, 5];

		const { nextPools, entries } = await applyRefillTriggersToPools(actor, pools, ['onAttacked']);

		expect(nextPools.judgment.faces).toEqual([4, 5]);
		expect(entries).toEqual([]);
	});

	it('L14 empty pool: onAttacked refills to 3 dice (max bumped by modifyPool)', async () => {
		const actor = makeOathsworn([judgmentPoolRule(), l14ModifyRule()]);
		const pools = buildEffectiveDicePoolMap(actor);
		expect(pools.judgment.max).toBe(3);

		const { nextPools } = await applyRefillTriggersToPools(actor, pools, ['onAttacked']);

		expect(nextPools.judgment.faces).toHaveLength(3);
	});

	it('encounterEnd wipes the Judgment Dice pool', async () => {
		const actor = makeOathsworn([judgmentPoolRule()]);
		const pools = buildEffectiveDicePoolMap(actor);
		pools.judgment.faces = [4, 6];

		const { nextPools, entries } = await applyRefillTriggersToPools(actor, pools, ['encounterEnd']);

		expect(nextPools.judgment.faces).toEqual([]);
		expect(entries).toHaveLength(1);
		expect(entries[0].trigger).toBe('encounterEnd');
	});
});
