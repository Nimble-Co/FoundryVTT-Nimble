import { describe, expect, it, vi } from 'vitest';
import {
	applyRecoveryTriggersToPools,
	buildEffectiveChargePoolMap,
	getChargeConsumers,
} from './helpers.js';
import type {
	CharacterActorLike,
	ChargeConsumerRuleLike,
	ChargePoolRuleLike,
	ModifyPoolRuleLike,
	RuleBackedItem,
} from './types.js';

type MockRule = (ChargePoolRuleLike | ChargeConsumerRuleLike | ModifyPoolRuleLike) & {
	type: string;
	id?: string;
	disabled?: boolean;
	appliesTo?: () => boolean;
	priority?: number;
};

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
	levelUpHistory: Array<{ poolMaxBonuses?: Record<string, number> }> = [],
): MockActor {
	return {
		type: 'character',
		system: { levelUpHistory },
		items: {
			contents: items,
			get: (id: string) => items.find((i) => i.id === id),
		},
		flags: actorFlags,
		getRollData: vi.fn(() => rollData),
	} as unknown as MockActor;
}

describe('charge pool modifier predicate gating', () => {
	it('skips modifyPool charge rules whose appliesTo() returns false', () => {
		// Base pool max=3; modifier wants +2 but its predicate returns false
		// (e.g. level gate not yet met). Resulting max should stay at 3.
		const actor = createMockActor([
			createMockItem('item-1', 'Mana', [
				{
					type: 'chargePool',
					id: 'mana-rule',
					identifier: 'mana',
					scope: 'item',
					max: '3',
					initial: 'max',
				} as MockRule,
			]),
			createMockItem('feat-1', 'Mana Boost L5', [
				{
					type: 'modifyPool',
					id: 'mod-l5',
					poolType: 'charge',
					poolIdentifier: 'mana',
					maxDelta: '+2',
					appliesTo: () => false,
				} as MockRule,
			]),
		]);

		const map = buildEffectiveChargePoolMap(actor);
		const pool = Object.values(map)[0];
		expect(pool.max).toBe(3);
	});

	it('applies modifyPool charge rules whose appliesTo() returns true', () => {
		const actor = createMockActor([
			createMockItem('item-1', 'Mana', [
				{
					type: 'chargePool',
					id: 'mana-rule',
					identifier: 'mana',
					scope: 'item',
					max: '3',
					initial: 'max',
				} as MockRule,
			]),
			createMockItem('feat-1', 'Mana Boost L5', [
				{
					type: 'modifyPool',
					id: 'mod-l5',
					poolType: 'charge',
					poolIdentifier: 'mana',
					maxDelta: '+2',
					appliesTo: () => true,
				} as MockRule,
			]),
		]);

		const map = buildEffectiveChargePoolMap(actor);
		const pool = Object.values(map)[0];
		expect(pool.max).toBe(5);
	});

	it('ignores modifyPool rules targeting dice pools', () => {
		const actor = createMockActor([
			createMockItem('item-1', 'Mana', [
				{
					type: 'chargePool',
					id: 'mana-rule',
					identifier: 'mana',
					scope: 'item',
					max: '3',
					initial: 'max',
				} as MockRule,
			]),
			createMockItem('feat-1', 'Wrong Type', [
				{
					type: 'modifyPool',
					id: 'mod-dice',
					poolType: 'dice',
					poolIdentifier: 'mana',
					maxDelta: '+2',
				} as MockRule,
			]),
		]);

		const map = buildEffectiveChargePoolMap(actor);
		const pool = Object.values(map)[0];
		expect(pool.max).toBe(3);
	});

	it('stacks multiple charge modifiers (later priority wins for last write semantics)', () => {
		const actor = createMockActor([
			createMockItem('item-1', 'Mana', [
				{
					type: 'chargePool',
					id: 'mana-rule',
					identifier: 'mana',
					scope: 'item',
					max: '3',
					initial: 'max',
				} as MockRule,
			]),
			createMockItem('feat-1', 'Boost +1', [
				{
					type: 'modifyPool',
					id: 'mod-a',
					poolType: 'charge',
					poolIdentifier: 'mana',
					maxDelta: '+1',
					priority: 1,
				} as MockRule,
			]),
			createMockItem('feat-2', 'Boost +2', [
				{
					type: 'modifyPool',
					id: 'mod-b',
					poolType: 'charge',
					poolIdentifier: 'mana',
					maxDelta: '+2',
					priority: 2,
				} as MockRule,
			]),
		]);

		const map = buildEffectiveChargePoolMap(actor);
		const pool = Object.values(map)[0];
		// 3 + 1 + 2 = 6
		expect(pool.max).toBe(6);
	});
});

describe('charge pool level-up max bonus (poolMaxBonus from history)', () => {
	it('adds the cumulative pool bonus from level-up history to the resolved max', () => {
		// Commander with STR 3 → base 3 combat dice; selected "+1 Max Combat Die" once.
		const actor = createMockActor(
			[
				createMockItem('ffab', 'Fit for Any Battlefield', [
					{
						type: 'chargePool',
						id: 'combat-dice-pool',
						identifier: 'combat-dice',
						scope: 'item',
						max: '@strength + @combatDiceBonus',
						initial: 'zero',
					} as MockRule,
				]),
			],
			{ strength: 3 },
			{},
			[{ poolMaxBonuses: { 'combat-dice': 1 } }],
		);

		const pool = Object.values(buildEffectiveChargePoolMap(actor))[0];
		expect(pool.max).toBe(4);
	});

	it('works even when the embedded formula is the stale "@strength" (ignores @combatDiceBonus)', () => {
		// Reproduces the reported bug: an actor whose embedded chargePool formula predates the
		// @combatDiceBonus change. The bonus must still apply because it is added in code.
		const actor = createMockActor(
			[
				createMockItem('ffab', 'Fit for Any Battlefield', [
					{
						type: 'chargePool',
						id: 'combat-dice-pool',
						identifier: 'combat-dice',
						scope: 'item',
						max: '@strength',
						initial: 'zero',
					} as MockRule,
				]),
			],
			{ strength: 3 },
			{},
			[{ poolMaxBonuses: { 'combat-dice': 1 } }],
		);

		const pool = Object.values(buildEffectiveChargePoolMap(actor))[0];
		expect(pool.max).toBe(4);
	});

	it('accumulates the bonus across multiple level-up selections', () => {
		const actor = createMockActor(
			[
				createMockItem('ffab', 'Fit for Any Battlefield', [
					{
						type: 'chargePool',
						id: 'combat-dice-pool',
						identifier: 'combat-dice',
						scope: 'item',
						max: '@strength',
						initial: 'zero',
					} as MockRule,
				]),
			],
			{ strength: 3 },
			{},
			[{ poolMaxBonuses: { 'combat-dice': 1 } }, { poolMaxBonuses: { 'combat-dice': 1 } }],
		);

		const pool = Object.values(buildEffectiveChargePoolMap(actor))[0];
		expect(pool.max).toBe(5);
	});

	it('drops the bonus when history no longer contains it (revert)', () => {
		// After reverting the level-up that added the bonus, history has no poolMaxBonuses → base only.
		const actor = createMockActor(
			[
				createMockItem('ffab', 'Fit for Any Battlefield', [
					{
						type: 'chargePool',
						id: 'combat-dice-pool',
						identifier: 'combat-dice',
						scope: 'item',
						max: '@strength',
						initial: 'zero',
					} as MockRule,
				]),
			],
			{ strength: 3 },
			{},
			[],
		);

		const pool = Object.values(buildEffectiveChargePoolMap(actor))[0];
		expect(pool.max).toBe(3);
	});
});

describe('charge consumer predicate gating', () => {
	function createConsumerItem(consumer: MockRule): MockItem {
		return createMockItem('item-1', 'Charged Feature', [
			{
				type: 'chargePool',
				id: 'pool-rule',
				identifier: 'focus',
				scope: 'item',
				max: '1',
				initial: 'max',
			} as MockRule,
			consumer,
		]);
	}

	it('skips a consumer whose appliesTo() returns false', () => {
		const item = createConsumerItem({
			type: 'chargeConsumer',
			id: 'consumer-rule',
			poolIdentifier: 'focus',
			poolScope: 'item',
			cost: '1',
			appliesTo: () => false,
		} as MockRule);
		const actor = createMockActor([item]);

		expect(getChargeConsumers(actor, item as unknown as RuleBackedItem)).toEqual([]);
	});

	it('keeps a consumer whose appliesTo() returns true', () => {
		const item = createConsumerItem({
			type: 'chargeConsumer',
			id: 'consumer-rule',
			poolIdentifier: 'focus',
			poolScope: 'item',
			cost: '1',
			appliesTo: () => true,
		} as MockRule);
		const actor = createMockActor([item]);

		expect(getChargeConsumers(actor, item as unknown as RuleBackedItem)).toEqual([
			{
				ruleId: 'consumer-rule',
				poolId: 'focus',
				poolIdentifier: 'focus',
				cost: 1,
				variable: false,
				maxCost: null,
			},
		]);
	});

	it('keeps a consumer that has no appliesTo at all', () => {
		const item = createConsumerItem({
			type: 'chargeConsumer',
			id: 'consumer-rule',
			poolIdentifier: 'focus',
			poolScope: 'item',
			cost: '1',
		} as MockRule);
		const actor = createMockActor([item]);

		expect(getChargeConsumers(actor, item as unknown as RuleBackedItem)).toEqual([
			{
				ruleId: 'consumer-rule',
				poolId: 'focus',
				poolIdentifier: 'focus',
				cost: 1,
				variable: false,
				maxCost: null,
			},
		]);
	});
});

describe('variable charge consumers', () => {
	function createVariableConsumerItem(overrides: Partial<MockRule> = {}): MockItem {
		return createMockItem('item-1', 'Flexible Feature', [
			{
				type: 'chargePool',
				id: 'pool-rule',
				identifier: 'focus',
				scope: 'item',
				max: '10',
				initial: 'max',
			} as MockRule,
			{
				type: 'chargeConsumer',
				id: 'consumer-rule',
				poolIdentifier: 'focus',
				poolScope: 'item',
				costMode: 'variable',
				cost: '1',
				maxCost: '',
				...overrides,
			} as MockRule,
		]);
	}

	it('is hidden from callers that spend a fixed cost', () => {
		const item = createVariableConsumerItem();
		const actor = createMockActor([item]);

		expect(getChargeConsumers(actor, item as unknown as RuleBackedItem)).toEqual([]);
	});

	it('is reported with its minimum and an open ceiling when asked for', () => {
		const item = createVariableConsumerItem();
		const actor = createMockActor([item]);

		expect(
			getChargeConsumers(actor, item as unknown as RuleBackedItem, { includeVariable: true }),
		).toEqual([
			{
				ruleId: 'consumer-rule',
				poolId: 'focus',
				poolIdentifier: 'focus',
				cost: 1,
				variable: true,
				maxCost: null,
			},
		]);
	});

	it('resolves a maxCost formula into the reported ceiling', () => {
		const item = createVariableConsumerItem({ maxCost: '3' } as Partial<MockRule>);
		const actor = createMockActor([item]);

		expect(
			getChargeConsumers(actor, item as unknown as RuleBackedItem, { includeVariable: true })[0]
				.maxCost,
		).toBe(3);
	});
});

describe('cross-item pool spending', () => {
	// An item-scoped pool id is the bare identifier, which is what lets a second
	// feature spend from a pool a first feature declares (a subclass feature
	// drawing on its base class's pool, say) without an actor-scoped pool.
	function createPoolAndConsumerItems(): { poolItem: MockItem; consumerItem: MockItem } {
		return {
			poolItem: createMockItem('item-1', 'Pool Owner', [
				{
					type: 'chargePool',
					id: 'pool-rule',
					identifier: 'focus',
					label: 'Focus',
					scope: 'item',
					max: '10',
					initial: 'max',
				} as MockRule,
			]),
			consumerItem: createMockItem('item-2', 'Other Feature', [
				{
					type: 'chargeConsumer',
					id: 'other-consumer',
					poolIdentifier: 'focus',
					poolScope: 'item',
					cost: '2',
				} as MockRule,
			]),
		};
	}

	it('resolves a consumer on one item to a pool declared on another', () => {
		const { poolItem, consumerItem } = createPoolAndConsumerItems();
		const actor = createMockActor([poolItem, consumerItem]);

		const [consumer] = getChargeConsumers(actor, consumerItem as unknown as RuleBackedItem);

		expect(consumer).toMatchObject({ poolId: 'focus', poolIdentifier: 'focus', cost: 2 });
		expect(buildEffectiveChargePoolMap(actor)[consumer!.poolId]).toMatchObject({
			identifier: 'focus',
			sourceItemId: 'item-1',
			current: 10,
		});
	});

	it('resolves a variable consumer on one item to the other item pool', () => {
		const { poolItem } = createPoolAndConsumerItems();
		const variableConsumer = createMockItem('item-2', 'Other Feature', [
			{
				type: 'chargeConsumer',
				id: 'other-consumer',
				poolIdentifier: 'focus',
				poolScope: 'item',
				costMode: 'variable',
				cost: '1',
				maxCost: '4',
			} as MockRule,
		]);
		const actor = createMockActor([poolItem, variableConsumer]);

		expect(
			getChargeConsumers(actor, variableConsumer as unknown as RuleBackedItem, {
				includeVariable: true,
			}),
		).toEqual([
			{
				ruleId: 'other-consumer',
				poolId: 'focus',
				poolIdentifier: 'focus',
				cost: 1,
				variable: true,
				maxCost: 4,
			},
		]);
	});
});

describe('charge pool predicate gating', () => {
	function createPoolItem(pool: MockRule): MockItem {
		return createMockItem('item-1', 'Gated Feature', [pool]);
	}

	const basePool = {
		type: 'chargePool',
		id: 'pool-rule',
		identifier: 'focus',
		scope: 'item',
		max: '1',
		initial: 'max',
	};

	it('omits a pool whose appliesTo() returns false', () => {
		// A pool only a later feature uses should not sit on the sheet showing a
		// full badge that never changes until that feature is gained.
		const item = createPoolItem({ ...basePool, appliesTo: () => false } as MockRule);
		const actor = createMockActor([item]);

		expect(buildEffectiveChargePoolMap(actor)).toEqual({});
	});

	it('keeps a pool whose appliesTo() returns true', () => {
		const item = createPoolItem({ ...basePool, appliesTo: () => true } as MockRule);
		const actor = createMockActor([item]);

		expect(Object.keys(buildEffectiveChargePoolMap(actor))).toEqual(['focus']);
	});

	it('keeps a pool that carries no appliesTo at all', () => {
		const item = createPoolItem({ ...basePool } as MockRule);
		const actor = createMockActor([item]);

		expect(Object.keys(buildEffectiveChargePoolMap(actor))).toEqual(['focus']);
	});
});

describe('charge pool modifier contributed recoveries', () => {
	function actorWithModifiers(modifiers: Partial<MockRule>[], poolMax = '3') {
		return createMockActor([
			createMockItem('item-1', 'Signature Ability', [
				{
					type: 'chargePool',
					id: 'uses-rule',
					identifier: 'uses',
					scope: 'item',
					max: poolMax,
					initial: 'max',
					recoveries: [{ trigger: 'safeRest', mode: 'refresh', value: '1' }],
				} as MockRule,
			]),
			...modifiers.map((modifier, index) =>
				createMockItem(`feat-${index}`, `Granting Feature ${index}`, [
					{
						type: 'modifyPool',
						id: `mod-${index}`,
						poolType: 'charge',
						poolIdentifier: 'uses',
						...modifier,
					} as MockRule,
				]),
			),
		]);
	}

	const encounterStart = { trigger: 'encounterStart', mode: 'add', value: '1' };

	it('appends contributed recoveries after the pool own', () => {
		// A feature can give an existing pool a new way to come back without the
		// pool's own rule knowing about it, which is otherwise impossible: a
		// recovery entry cannot be declared cross-item.
		const actor = actorWithModifiers([{ addRefills: [encounterStart], appliesTo: () => true }]);

		const pool = Object.values(buildEffectiveChargePoolMap(actor))[0];
		expect(pool.recoveries).toEqual([
			{ trigger: 'safeRest', mode: 'refresh', value: '1' },
			encounterStart,
		]);
	});

	it('contributes nothing while the modifier predicate does not hold', () => {
		const actor = actorWithModifiers([{ addRefills: [encounterStart], appliesTo: () => false }]);

		const pool = Object.values(buildEffectiveChargePoolMap(actor))[0];
		expect(pool.recoveries).toEqual([{ trigger: 'safeRest', mode: 'refresh', value: '1' }]);
	});

	it('drops a contributed entry whose trigger charge pools do not have', () => {
		// The modifier trigger vocabulary is the union of both pool types, so one
		// only dice pools dispatch must not reach a charge pool.
		const actor = actorWithModifiers([
			{
				addRefills: [{ trigger: 'onAttacked', mode: 'add', value: '1' }, encounterStart],
				appliesTo: () => true,
			},
		]);

		const pool = Object.values(buildEffectiveChargePoolMap(actor))[0];
		expect(pool.recoveries).toEqual([
			{ trigger: 'safeRest', mode: 'refresh', value: '1' },
			encounterStart,
		]);
	});

	it('drops a contributed entry whose mode charge pools cannot perform', () => {
		// The mode list is the dice one, which is wider. Coercing `clear` to the
		// default would empty nothing and add instead, the opposite of the ask.
		const actor = actorWithModifiers([
			{
				addRefills: [{ trigger: 'encounterStart', mode: 'clear', value: '1' }],
				appliesTo: () => true,
			},
		]);

		const pool = Object.values(buildEffectiveChargePoolMap(actor))[0];
		expect(pool.recoveries).toEqual([{ trigger: 'safeRest', mode: 'refresh', value: '1' }]);
	});

	it('leaves the pool alone when the modifier contributes no entries', () => {
		const actor = actorWithModifiers([{ maxDelta: '+1', appliesTo: () => true }]);

		const pool = Object.values(buildEffectiveChargePoolMap(actor))[0];
		expect(pool.max).toBe(4);
		expect(pool.recoveries).toEqual([{ trigger: 'safeRest', mode: 'refresh', value: '1' }]);
	});

	it('raises the pool when the contributed trigger fires, clamped at max', () => {
		const actor = actorWithModifiers([{ addRefills: [encounterStart], appliesTo: () => true }]);
		const pools = buildEffectiveChargePoolMap(actor);
		const poolId = Object.keys(pools)[0];

		pools[poolId].current = 1;
		const raised = applyRecoveryTriggersToPools(actor, pools, ['encounterStart']);
		expect(raised[poolId].current).toBe(2);

		// A full pool gains nothing, which is what regaining a spent use means.
		raised[poolId].current = 3;
		expect(applyRecoveryTriggersToPools(actor, raised, ['encounterStart'])[poolId].current).toBe(3);
	});

	it('stacks two modifiers contributing to the same pool', () => {
		const actor = actorWithModifiers(
			[
				{ addRefills: [encounterStart], appliesTo: () => true },
				{ addRefills: [encounterStart], appliesTo: () => true },
			],
			'5',
		);
		const pools = buildEffectiveChargePoolMap(actor);
		const poolId = Object.keys(pools)[0];

		pools[poolId].current = 0;
		expect(applyRecoveryTriggersToPools(actor, pools, ['encounterStart'])[poolId].current).toBe(2);
	});

	it('honours a contributed entry own predicate when the trigger fires', () => {
		const gated = { ...encounterStart, predicate: { self: 'raging' } };
		const actor = actorWithModifiers([{ addRefills: [gated], appliesTo: () => true }]);
		const pools = buildEffectiveChargePoolMap(actor);
		const poolId = Object.keys(pools)[0];
		pools[poolId].current = 0;

		// No domain, so the condition does not hold and the recovery is skipped.
		expect(applyRecoveryTriggersToPools(actor, pools, ['encounterStart'])[poolId].current).toBe(0);

		(actor as unknown as { getDomain: () => Set<string> }).getDomain = () =>
			new Set(['self:raging']);
		expect(applyRecoveryTriggersToPools(actor, pools, ['encounterStart'])[poolId].current).toBe(1);
	});
});
