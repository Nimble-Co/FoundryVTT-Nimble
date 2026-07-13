import { describe, expect, it, vi } from 'vitest';
import {
	applyModifiersToDefinition,
	areDicePoolMapsEqual,
	areFaceArraysEqual,
	buildDicePoolId,
	buildEffectiveDicePoolMap,
	dieSizeToMaxFace,
	getDicePoolDefinitions,
	getDicePoolMapFromActor,
	getDicePoolModifiers,
	normalizeFaces,
	normalizeRefills,
	reconcileDicePoolState,
	toDieSize,
} from './helpers.js';
import type {
	CharacterActorLike,
	DicePoolDefinition,
	DicePoolRuleAny,
	DicePoolState,
	DieSize,
} from './types.js';

type MockRule = DicePoolRuleAny & { type: string };

type MockItem = {
	id: string;
	name: string;
	rules: Map<string, MockRule>;
	flags: Record<string, Record<string, unknown>>;
};

type MockActor = CharacterActorLike & {
	flags: Record<string, Record<string, unknown>>;
};

function createMockItem(
	id: string,
	name: string,
	rules: MockRule[],
	flags: Record<string, Record<string, unknown>> = {},
): MockItem {
	return {
		id,
		name,
		rules: new Map(rules.map((rule, idx) => [String(idx), rule])),
		flags,
	};
}

function createMockActor(
	items: MockItem[],
	rollData: Record<string, unknown> = {},
	actorFlags: Record<string, Record<string, unknown>> = {},
): MockActor {
	const actor = {
		type: 'character',
		items: {
			contents: items,
			get: (id: string) => items.find((i) => i.id === id),
		},
		flags: actorFlags,
		getRollData: vi.fn(() => rollData),
	} as unknown as MockActor;
	return actor;
}

describe('toDieSize', () => {
	it('accepts valid die sizes', () => {
		expect(toDieSize('d4')).toBe('d4');
		expect(toDieSize('d20')).toBe('d20');
	});

	it('returns fallback for invalid input', () => {
		expect(toDieSize('d3')).toBe('d4');
		expect(toDieSize('not-a-die', 'd8' as DieSize)).toBe('d8');
		expect(toDieSize(null)).toBe('d4');
		expect(toDieSize(undefined)).toBe('d4');
		expect(toDieSize(42)).toBe('d4');
	});
});

describe('dieSizeToMaxFace', () => {
	it('extracts the numeric face count from a die size', () => {
		expect(dieSizeToMaxFace('d4')).toBe(4);
		expect(dieSizeToMaxFace('d6')).toBe(6);
		expect(dieSizeToMaxFace('d20')).toBe(20);
	});
});

describe('buildDicePoolId', () => {
	it('prefixes actor-scoped pools with "actor:"', () => {
		expect(buildDicePoolId('actor', 'fury', 'item-1')).toBe('actor:fury');
	});

	it('returns the bare identifier for item-scoped pools', () => {
		expect(buildDicePoolId('item', 'fury', 'item-1')).toBe('fury');
	});
});

describe('normalizeFaces', () => {
	it('clamps face values to die size range', () => {
		expect(normalizeFaces([0, 4, 5, 7], 'd6', 10)).toEqual([1, 4, 5, 6]);
	});

	it('truncates to max length', () => {
		expect(normalizeFaces([1, 2, 3, 4], 'd6', 2)).toEqual([1, 2]);
	});

	it('returns empty array for non-array input', () => {
		expect(normalizeFaces(null, 'd6', 5)).toEqual([]);
		expect(normalizeFaces('nope', 'd6', 5)).toEqual([]);
	});

	it('drops non-finite values', () => {
		expect(normalizeFaces([1, NaN, 3, Infinity], 'd6', 10)).toEqual([1, 3]);
	});
});

describe('normalizeRefills', () => {
	it('filters out invalid triggers', () => {
		const refills = normalizeRefills([
			{ trigger: 'safeRest', mode: 'add', value: '1' },
			{ trigger: 'bogusTrigger', mode: 'add', value: '1' },
		]);

		expect(refills).toHaveLength(1);
		expect(refills[0].trigger).toBe('safeRest');
	});

	it('defaults invalid modes to "add"', () => {
		const refills = normalizeRefills([{ trigger: 'safeRest', mode: 'bogus', value: '2' }]);
		expect(refills[0].mode).toBe('add');
	});

	it('defaults missing value to "1"', () => {
		const refills = normalizeRefills([{ trigger: 'safeRest', mode: 'set' }]);
		expect(refills[0].value).toBe('1');
	});

	it('returns empty array for non-array input', () => {
		expect(normalizeRefills(null)).toEqual([]);
	});
});

describe('getDicePoolDefinitions', () => {
	it('extracts dicePool rule definitions from actor items', () => {
		const actor = createMockActor([
			createMockItem('item-1', 'Rage', [
				{
					type: 'dicePool',
					id: 'fury-rule',
					identifier: 'fury',
					scope: 'item',
					dieSize: 'd4',
					max: '3',
					initial: 'zero',
					refills: [{ trigger: 'safeRest', mode: 'refresh', value: '1' }],
				},
			]),
		]);

		const defs = getDicePoolDefinitions(actor);

		expect(defs).toHaveLength(1);
		expect(defs[0].identifier).toBe('fury');
		expect(defs[0].dieSize).toBe('d4');
		expect(defs[0].max).toBe(3);
		expect(defs[0].initial).toBe('zero');
		expect(defs[0].refills).toHaveLength(1);
	});

	it('skips disabled rules', () => {
		const actor = createMockActor([
			createMockItem('item-1', 'Rage', [
				{
					type: 'dicePool',
					id: 'fury-rule',
					identifier: 'fury',
					scope: 'item',
					dieSize: 'd4',
					max: '3',
					initial: 'zero',
					disabled: true,
				},
			]),
		]);

		expect(getDicePoolDefinitions(actor)).toHaveLength(0);
	});

	it('skips rules with missing identifier', () => {
		const actor = createMockActor([
			createMockItem('item-1', 'Bad', [
				{
					type: 'dicePool',
					scope: 'item',
					dieSize: 'd4',
					max: '3',
				},
			]),
		]);

		expect(getDicePoolDefinitions(actor)).toHaveLength(0);
	});

	it('defaults to consumption=manual when no diceConsumer rule is present', () => {
		const actor = createMockActor([
			createMockItem('item-1', 'Plain Pool', [
				{
					type: 'dicePool',
					id: 'judgment-rule',
					identifier: 'judgment',
					scope: 'actor',
					dieSize: 'd6',
					max: '2',
					initial: 'max',
				},
			]),
		]);

		const defs = getDicePoolDefinitions(actor);
		expect(defs).toHaveLength(1);
		expect(defs[0].consumption).toBe('manual');
		expect(defs[0].bonusOnAttackDelivery).toBe(null);
	});

	it('derives consumption + bonusOnAttackDelivery from a paired diceConsumer rule on the same item', () => {
		const actor = createMockActor([
			createMockItem('item-1', 'Rage', [
				{
					type: 'dicePool',
					id: 'fury-pool-base',
					identifier: 'fury',
					scope: 'item',
					dieSize: 'd4',
					max: '3',
					initial: 'zero',
				},
				{
					type: 'diceConsumer',
					id: 'fury-autobonus',
					poolIdentifier: 'fury',
					poolScope: 'item',
					mode: 'autoBonus',
					cost: '1',
					bonusOnAttackDelivery: 'melee',
				} as MockRule,
			]),
		]);

		const defs = getDicePoolDefinitions(actor);
		expect(defs).toHaveLength(1);
		expect(defs[0].consumption).toBe('autoBonus');
		expect(defs[0].bonusOnAttackDelivery).toBe('melee');
	});

	it('ignores diceConsumer rules that target a different pool identifier', () => {
		const actor = createMockActor([
			createMockItem('item-1', 'Mixed Pools', [
				{
					type: 'dicePool',
					id: 'fury-pool-base',
					identifier: 'fury',
					scope: 'item',
				},
				{
					type: 'diceConsumer',
					id: 'judgment-autobonus',
					poolIdentifier: 'judgment',
					poolScope: 'actor',
					mode: 'autoBonus',
					cost: '1',
					bonusOnAttackDelivery: 'any',
				} as MockRule,
			]),
		]);

		const defs = getDicePoolDefinitions(actor);
		expect(defs[0].consumption).toBe('manual');
		expect(defs[0].bonusOnAttackDelivery).toBe(null);
	});

	it('ignores disabled diceConsumer rules', () => {
		const actor = createMockActor([
			createMockItem('item-1', 'Rage', [
				{
					type: 'dicePool',
					id: 'fury-pool-base',
					identifier: 'fury',
					scope: 'item',
				},
				{
					type: 'diceConsumer',
					id: 'fury-autobonus',
					poolIdentifier: 'fury',
					mode: 'autoBonus',
					bonusOnAttackDelivery: 'melee',
					disabled: true,
				} as MockRule,
			]),
		]);

		const defs = getDicePoolDefinitions(actor);
		expect(defs[0].consumption).toBe('manual');
	});

	it('skips diceConsumer rules whose appliesTo() predicate returns false (self:raging gating)', () => {
		// Rage's auto-bonus is predicated on self:raging. When the toggle is off
		// the predicate fails, and the pool must report manual consumption so
		// the Fury Dice no longer auto-add to melee attacks.
		const actor = createMockActor([
			createMockItem('item-1', 'Rage', [
				{
					type: 'dicePool',
					id: 'fury-pool-base',
					identifier: 'fury',
					scope: 'item',
				},
				{
					type: 'diceConsumer',
					id: 'fury-autobonus',
					poolIdentifier: 'fury',
					mode: 'autoBonus',
					bonusOnAttackDelivery: 'melee',
					appliesTo: () => false,
				} as MockRule,
			]),
		]);

		const defs = getDicePoolDefinitions(actor);
		expect(defs[0].consumption).toBe('manual');
		expect(defs[0].bonusOnAttackDelivery).toBe(null);
	});

	it('honors diceConsumer rules whose appliesTo() predicate returns true', () => {
		const actor = createMockActor([
			createMockItem('item-1', 'Rage', [
				{
					type: 'dicePool',
					id: 'fury-pool-base',
					identifier: 'fury',
					scope: 'item',
				},
				{
					type: 'diceConsumer',
					id: 'fury-autobonus',
					poolIdentifier: 'fury',
					mode: 'autoBonus',
					bonusOnAttackDelivery: 'melee',
					appliesTo: () => true,
				} as MockRule,
			]),
		]);

		const defs = getDicePoolDefinitions(actor);
		expect(defs[0].consumption).toBe('autoBonus');
		expect(defs[0].bonusOnAttackDelivery).toBe('melee');
	});
});

describe('getDicePoolModifiers', () => {
	it('collects modifyPool rules with poolType=dice keyed by poolIdentifier', () => {
		const actor = createMockActor([
			createMockItem('feat-1', 'Intensifying Fury L2', [
				{
					type: 'modifyPool',
					id: 'mod-1',
					poolType: 'dice',
					poolIdentifier: 'fury',
					dieSize: 'd6',
				},
			]),
			createMockItem('feat-2', 'Rage 2', [
				{
					type: 'modifyPool',
					id: 'mod-2',
					poolType: 'dice',
					poolIdentifier: 'fury',
					maxDelta: '+1',
				},
			]),
		]);

		const mods = getDicePoolModifiers(actor);
		expect(mods.get('fury')).toHaveLength(2);
	});

	it('ignores disabled modifiers', () => {
		const actor = createMockActor([
			createMockItem('feat-1', 'Disabled', [
				{
					type: 'modifyPool',
					id: 'mod-1',
					poolType: 'dice',
					poolIdentifier: 'fury',
					dieSize: 'd6',
					disabled: true,
				},
			]),
		]);

		expect(getDicePoolModifiers(actor).has('fury')).toBe(false);
	});

	it('ignores modifyPool rules targeting charge pools', () => {
		const actor = createMockActor([
			createMockItem('feat-1', 'Charge Modifier', [
				{
					type: 'modifyPool',
					id: 'mod-1',
					poolType: 'charge',
					poolIdentifier: 'fury',
					dieSize: 'd6',
				},
			]),
		]);

		expect(getDicePoolModifiers(actor).has('fury')).toBe(false);
	});

	it('skips modifiers whose appliesTo() predicate returns false (level-gating)', () => {
		// Simulates Intensifying Fury L6: appliesTo checks actor level and returns
		// false on a level 5 character, so the d6 upgrade must not apply.
		const actor = createMockActor([
			createMockItem('feat-1', 'Intensifying Fury L6', [
				{
					type: 'modifyPool',
					id: 'mod-l6',
					poolType: 'dice',
					poolIdentifier: 'fury',
					dieSize: 'd6',
					appliesTo: () => false,
				} as MockRule,
			]),
		]);

		expect(getDicePoolModifiers(actor).has('fury')).toBe(false);
	});

	it('includes modifiers whose appliesTo() predicate returns true', () => {
		const actor = createMockActor([
			createMockItem('feat-1', 'Intensifying Fury L6', [
				{
					type: 'modifyPool',
					id: 'mod-l6',
					poolType: 'dice',
					poolIdentifier: 'fury',
					dieSize: 'd6',
					appliesTo: () => true,
				} as MockRule,
			]),
		]);

		expect(getDicePoolModifiers(actor).get('fury')).toHaveLength(1);
	});

	it('sorts modifiers by priority ascending so higher priority wins last', () => {
		const actor = createMockActor([
			createMockItem('feat-1', 'Late Mod', [
				{
					type: 'modifyPool',
					id: 'mod-late',
					poolType: 'dice',
					poolIdentifier: 'fury',
					dieSize: 'd10',
					priority: 10,
				} as MockRule,
			]),
			createMockItem('feat-2', 'Early Mod', [
				{
					type: 'modifyPool',
					id: 'mod-early',
					poolType: 'dice',
					poolIdentifier: 'fury',
					dieSize: 'd6',
					priority: 1,
				} as MockRule,
			]),
		]);

		const mods = getDicePoolModifiers(actor).get('fury');
		expect(mods).toHaveLength(2);
		expect((mods?.[0] as { id?: string }).id).toBe('mod-early');
		expect((mods?.[1] as { id?: string }).id).toBe('mod-late');
	});
});

describe('Fury Die size breakpoints (Intensifying Fury regression)', () => {
	// Mirrors the shipped data: rage.json's base dicePool rule (d4) plus
	// intensifying-fury.json's four level-predicated modifyPool upgrades.
	// Pins the RAW progression (d4 base, d6 at 6, d8 at 9, d10 at 13, d12 at
	// 17) so a change to either pack file or the modifier pipeline that
	// breaks the scaling fails here.
	function buildBerserkerActor(level: number): MockActor {
		const rageItem = createMockItem('rage-item', 'Rage', [
			{
				type: 'dicePool',
				id: 'fury-pool-base',
				identifier: 'fury',
				scope: 'item',
				dieSize: 'd4',
				max: '2',
				initial: 'zero',
				refills: [],
			},
		]);

		const upgrade = (min: number, dieSize: string, priority: number): MockRule =>
			({
				type: 'modifyPool',
				id: `fury-${dieSize}-l${min}`,
				poolType: 'dice',
				poolIdentifier: 'fury',
				dieSize,
				priority,
				appliesTo: () => level >= min,
			}) as MockRule;

		const intensifyingFury = createMockItem('int-fury-item', 'Intensifying Fury', [
			upgrade(6, 'd6', 2),
			upgrade(9, 'd8', 3),
			upgrade(13, 'd10', 4),
			upgrade(17, 'd12', 5),
		]);

		return createMockActor([rageItem, intensifyingFury], { level });
	}

	const breakpoints: Array<[number, DieSize]> = [
		[1, 'd4'],
		[5, 'd4'],
		[6, 'd6'],
		[8, 'd6'],
		[9, 'd8'],
		[12, 'd8'],
		[13, 'd10'],
		[16, 'd10'],
		[17, 'd12'],
		[20, 'd12'],
	];

	for (const [level, expected] of breakpoints) {
		it(`yields ${expected} Fury Dice at level ${level}`, () => {
			const pools = buildEffectiveDicePoolMap(buildBerserkerActor(level));
			expect(pools.fury?.dieSize).toBe(expected);
		});
	}
});

describe('applyModifiersToDefinition', () => {
	const baseDefinition: DicePoolDefinition = {
		id: 'fury',
		identifier: 'fury',
		scope: 'item',
		sourceItemId: 'item-1',
		sourceItemName: 'Rage',
		label: 'Fury Dice',
		dieSize: 'd4',
		max: 3,
		initial: 'zero',
		refills: [],
		consumption: 'manual',
		bonusOnAttackDelivery: null,
	};

	it('returns definition unchanged when no modifiers', () => {
		const actor = createMockActor([]);
		const result = applyModifiersToDefinition(actor, baseDefinition, undefined);
		expect(result).toBe(baseDefinition);
	});

	it('upgrades die size when a modifier provides one', () => {
		const actor = createMockActor([]);
		const result = applyModifiersToDefinition(actor, baseDefinition, [
			{ type: 'modifyPool', poolType: 'dice', poolIdentifier: 'fury', dieSize: 'd8' },
		]);

		expect(result.dieSize).toBe('d8');
		expect(result.max).toBe(3);
	});

	it('applies positive maxDelta additively', () => {
		const actor = createMockActor([]);
		const result = applyModifiersToDefinition(actor, baseDefinition, [
			{ type: 'modifyPool', poolType: 'dice', poolIdentifier: 'fury', maxDelta: '+2' },
		]);

		expect(result.max).toBe(5);
		expect(result.dieSize).toBe('d4');
	});

	it('stacks multiple modifiers', () => {
		const actor = createMockActor([]);
		const result = applyModifiersToDefinition(actor, baseDefinition, [
			{ type: 'modifyPool', poolType: 'dice', poolIdentifier: 'fury', dieSize: 'd6' },
			{ type: 'modifyPool', poolType: 'dice', poolIdentifier: 'fury', dieSize: 'd8' },
			{ type: 'modifyPool', poolType: 'dice', poolIdentifier: 'fury', maxDelta: '+1' },
		]);

		// Last dieSize wins, max sums.
		expect(result.dieSize).toBe('d8');
		expect(result.max).toBe(4);
	});

	it('clamps negative maxDelta at zero', () => {
		const actor = createMockActor([]);
		const result = applyModifiersToDefinition(actor, baseDefinition, [
			{ type: 'modifyPool', poolType: 'dice', poolIdentifier: 'fury', maxDelta: '-10' },
		]);
		expect(result.max).toBe(0);
	});

	it('ignores null/empty modifier fields', () => {
		const actor = createMockActor([]);
		const result = applyModifiersToDefinition(actor, baseDefinition, [
			{
				type: 'modifyPool',
				poolType: 'dice',
				poolIdentifier: 'fury',
				dieSize: null,
				maxDelta: null,
			},
		]);
		expect(result.dieSize).toBe('d4');
		expect(result.max).toBe(3);
	});
});

describe('reconcileDicePoolState', () => {
	const definition: DicePoolDefinition = {
		id: 'fury',
		identifier: 'fury',
		scope: 'item',
		sourceItemId: 'item-1',
		sourceItemName: 'Rage',
		label: 'Fury Dice',
		dieSize: 'd6',
		max: 3,
		initial: 'zero',
		refills: [],
		consumption: 'manual',
		bonusOnAttackDelivery: null,
	};

	it('produces fresh state with empty faces when no existing state', () => {
		const result = reconcileDicePoolState(undefined, definition);
		expect(result.faces).toEqual([]);
		expect(result.max).toBe(3);
		expect(result.dieSize).toBe('d6');
	});

	it('preserves existing faces within new max', () => {
		const existing: DicePoolState = {
			...definition,
			faces: [3, 1],
		};
		const result = reconcileDicePoolState(existing, definition);
		expect(result.faces).toEqual([3, 1]);
	});

	it('truncates faces when max shrank', () => {
		const existing: DicePoolState = {
			...definition,
			faces: [3, 1, 6, 4, 2],
		};
		const result = reconcileDicePoolState(existing, definition);
		// max is 3, so the last two get dropped (truncate from end).
		expect(result.faces).toEqual([3, 1, 6]);
	});

	it('keeps stored faces when dieSize changes (handled at refill time)', () => {
		const existing: DicePoolState = {
			...definition,
			dieSize: 'd4',
			faces: [3, 1],
		};
		const result = reconcileDicePoolState(existing, definition);
		// Definition is d6 now; stored faces from d4 remain (the design call).
		expect(result.dieSize).toBe('d6');
		expect(result.faces).toEqual([3, 1]);
	});
});

describe('getDicePoolMapFromActor', () => {
	it('reads item-scoped pools from item flags', () => {
		const actor = createMockActor([
			createMockItem('item-1', 'Rage', [], {
				nimble: {
					dicePools: {
						fury: {
							identifier: 'fury',
							dieSize: 'd4',
							max: 3,
							faces: [2, 4],
						},
					},
				},
			}),
		]);

		const map = getDicePoolMapFromActor(actor);
		expect(map.fury).toBeDefined();
		expect(map.fury.faces).toEqual([2, 4]);
		expect(map.fury.dieSize).toBe('d4');
		expect(map.fury.scope).toBe('item');
	});

	it('reads actor-scoped pools from actor flags', () => {
		const actor = createMockActor(
			[],
			{},
			{
				nimble: {
					dicePools: {
						'actor:judgment': {
							identifier: 'judgment',
							dieSize: 'd6',
							max: 2,
							faces: [4, 6],
						},
					},
				},
			},
		);

		const map = getDicePoolMapFromActor(actor);
		expect(map['actor:judgment']).toBeDefined();
		expect(map['actor:judgment'].scope).toBe('actor');
		expect(map['actor:judgment'].faces).toEqual([4, 6]);
	});
});

describe('buildEffectiveDicePoolMap', () => {
	it('combines definitions with existing flag state, applying modifiers', () => {
		const actor = createMockActor([
			createMockItem(
				'item-1',
				'Rage',
				[
					{
						type: 'dicePool',
						id: 'fury-rule',
						identifier: 'fury',
						scope: 'item',
						dieSize: 'd4',
						max: '3',
						initial: 'zero',
					},
				],
				{
					nimble: {
						dicePools: {
							fury: {
								identifier: 'fury',
								dieSize: 'd4',
								max: 3,
								faces: [3, 1],
							},
						},
					},
				},
			),
			createMockItem('item-2', 'Intensifying Fury', [
				{
					type: 'modifyPool',
					id: 'mod-1',
					poolType: 'dice',
					poolIdentifier: 'fury',
					dieSize: 'd6',
					maxDelta: '+1',
				},
			]),
		]);

		const map = buildEffectiveDicePoolMap(actor);
		expect(map.fury.dieSize).toBe('d6'); // upgraded
		expect(map.fury.max).toBe(4); // 3 + 1
		expect(map.fury.faces).toEqual([3, 1]); // preserved
	});

	it('skips dicePool rules with no identifier and empties state for missing definitions', () => {
		const actor = createMockActor([
			createMockItem('item-1', 'Stale Pool', [], {
				nimble: {
					dicePools: {
						orphan: {
							identifier: 'orphan',
							dieSize: 'd6',
							max: 2,
							faces: [4],
						},
					},
				},
			}),
		]);

		const map = buildEffectiveDicePoolMap(actor);
		// No rule defines "orphan" → it's not in the effective map.
		expect(map.orphan).toBeUndefined();
	});
});

describe('areFaceArraysEqual', () => {
	it('returns true for identical face arrays', () => {
		expect(areFaceArraysEqual([1, 2, 3], [1, 2, 3])).toBe(true);
	});

	it('returns false for different lengths or values', () => {
		expect(areFaceArraysEqual([1, 2], [1, 2, 3])).toBe(false);
		expect(areFaceArraysEqual([1, 2, 3], [1, 2, 4])).toBe(false);
	});
});

describe('areDicePoolMapsEqual', () => {
	const stateA: DicePoolState = {
		id: 'fury',
		identifier: 'fury',
		scope: 'item',
		sourceItemId: 'item-1',
		sourceItemName: 'Rage',
		label: 'Fury',
		dieSize: 'd4',
		max: 3,
		faces: [2, 4],
		refills: [],
		consumption: 'manual',
		bonusOnAttackDelivery: null,
	};

	it('returns true for matching maps', () => {
		expect(areDicePoolMapsEqual({ fury: stateA }, { fury: { ...stateA, faces: [2, 4] } })).toBe(
			true,
		);
	});

	it('returns false when face contents differ', () => {
		expect(areDicePoolMapsEqual({ fury: stateA }, { fury: { ...stateA, faces: [2, 5] } })).toBe(
			false,
		);
	});

	it('returns false when one map has extra pools', () => {
		expect(
			areDicePoolMapsEqual({ fury: stateA }, { fury: stateA, judgment: { ...stateA, id: 'j' } }),
		).toBe(false);
	});
});
