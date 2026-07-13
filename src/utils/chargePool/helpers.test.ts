import { describe, expect, it, vi } from 'vitest';
import { buildEffectiveChargePoolMap } from './helpers.js';
import type { CharacterActorLike, ChargePoolRuleLike, ModifyPoolRuleLike } from './types.js';

type MockRule = (ChargePoolRuleLike | ModifyPoolRuleLike) & {
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
