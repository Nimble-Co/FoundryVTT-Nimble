import { describe, expect, it, vi } from 'vitest';
import { getDicePoolConsumers } from './dicePoolConsumers.js';
import type { CharacterActorLike, DicePoolRuleAny, DicePoolState } from './types.js';

type MockRule = DicePoolRuleAny & { type: string; label?: string };

type MockItem = {
	id: string;
	name: string;
	img: string | null;
	rules: Map<string, MockRule>;
	system: { description: string };
};

type MockActor = CharacterActorLike;

function createMockItem(
	id: string,
	name: string,
	rules: MockRule[],
	overrides: { img?: string | null; description?: string } = {},
): MockItem {
	return {
		id,
		name,
		img: overrides.img ?? `icons/${id}.webp`,
		rules: new Map(rules.map((rule, idx) => [rule.id ?? String(idx), rule])),
		system: { description: overrides.description ?? `${name} description` },
	};
}

function createMockActor(items: MockItem[]): MockActor {
	return {
		type: 'character',
		items: {
			contents: items,
			get: (id: string) => items.find((i) => i.id === id),
		},
		getRollData: vi.fn(() => ({})),
	} as unknown as MockActor;
}

function createFuryPool(overrides: Partial<DicePoolState> = {}): DicePoolState {
	return {
		id: 'item-rage:fury',
		identifier: 'fury',
		scope: 'item',
		sourceItemId: 'item-rage',
		sourceItemName: 'Rage',
		label: 'Fury Dice',
		dieSize: 'd4',
		max: 3,
		faces: [2, 3, 4],
		refills: [],
		consumption: 'manual',
		bonusOnAttackDelivery: null,
		...overrides,
	};
}

describe('getDicePoolConsumers', () => {
	it('returns an empty list for a non-character actor', () => {
		const result = getDicePoolConsumers(null, createFuryPool());
		expect(result).toEqual([]);
	});

	it('finds manual diceConsumer rules with an effectFormula targeting the pool', () => {
		const actor = createMockActor([
			createMockItem('tayg', 'That all you got?!', [
				{
					type: 'diceConsumer',
					id: 'tayg-consumer',
					label: 'TAYG',
					poolIdentifier: 'fury',
					poolScope: 'item',
					mode: 'manual',
					cost: '1',
					bonusOnAttackDelivery: null,
					effectFormula: '(@str + @dex) * @n',
				} as MockRule,
			]),
		]);

		const result = getDicePoolConsumers(actor, createFuryPool());
		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({
			itemId: 'tayg',
			itemName: 'That all you got?!',
			ruleId: 'tayg-consumer',
			cost: '1',
			effectFormula: '(@str + @dex) * @n',
		});
		expect(result[0].itemImg).toBe('icons/tayg.webp');
		expect(result[0].itemDescription).toBe('That all you got?! description');
	});

	it('excludes autoBonus consumers (the Rage feature itself)', () => {
		const actor = createMockActor([
			createMockItem('rage', 'Rage', [
				{
					type: 'diceConsumer',
					id: 'rage-autobonus',
					poolIdentifier: 'fury',
					poolScope: 'item',
					mode: 'autoBonus',
					cost: '1',
					bonusOnAttackDelivery: 'melee',
					effectFormula: null,
				} as MockRule,
			]),
		]);

		expect(getDicePoolConsumers(actor, createFuryPool())).toEqual([]);
	});

	it('excludes manual consumers without an effectFormula', () => {
		const actor = createMockActor([
			createMockItem('silent-spender', 'Silent Spender', [
				{
					type: 'diceConsumer',
					id: 'silent-consumer',
					poolIdentifier: 'fury',
					poolScope: 'item',
					mode: 'manual',
					cost: '1',
					bonusOnAttackDelivery: null,
					effectFormula: null,
				} as MockRule,
			]),
		]);

		expect(getDicePoolConsumers(actor, createFuryPool())).toEqual([]);
	});

	it('excludes consumers targeting a different pool identifier', () => {
		const actor = createMockActor([
			createMockItem('judgment-spender', 'Judgment Spender', [
				{
					type: 'diceConsumer',
					id: 'consumer',
					poolIdentifier: 'judgment',
					poolScope: 'actor',
					mode: 'manual',
					cost: '1',
					bonusOnAttackDelivery: null,
					effectFormula: '@n',
				} as MockRule,
			]),
		]);

		expect(getDicePoolConsumers(actor, createFuryPool())).toEqual([]);
	});

	it('excludes consumers whose poolScope does not match the pool', () => {
		const actor = createMockActor([
			createMockItem('wrong-scope', 'Wrong Scope', [
				{
					type: 'diceConsumer',
					id: 'consumer',
					poolIdentifier: 'fury',
					poolScope: 'actor',
					mode: 'manual',
					cost: '1',
					bonusOnAttackDelivery: null,
					effectFormula: '@n',
				} as MockRule,
			]),
		]);

		expect(getDicePoolConsumers(actor, createFuryPool({ scope: 'item' }))).toEqual([]);
	});

	it('excludes disabled consumers', () => {
		const actor = createMockActor([
			createMockItem('disabled', 'Disabled', [
				{
					type: 'diceConsumer',
					id: 'consumer',
					poolIdentifier: 'fury',
					poolScope: 'item',
					mode: 'manual',
					cost: '1',
					disabled: true,
					bonusOnAttackDelivery: null,
					effectFormula: '@n',
				} as MockRule,
			]),
		]);

		expect(getDicePoolConsumers(actor, createFuryPool())).toEqual([]);
	});

	it('sorts results by item name', () => {
		const actor = createMockActor([
			createMockItem('z-item', 'Zeta Strike', [
				{
					type: 'diceConsumer',
					id: 'z-consumer',
					poolIdentifier: 'fury',
					poolScope: 'item',
					mode: 'manual',
					cost: '1',
					bonusOnAttackDelivery: null,
					effectFormula: '@n',
				} as MockRule,
			]),
			createMockItem('a-item', 'Alpha Strike', [
				{
					type: 'diceConsumer',
					id: 'a-consumer',
					poolIdentifier: 'fury',
					poolScope: 'item',
					mode: 'manual',
					cost: '1',
					bonusOnAttackDelivery: null,
					effectFormula: '@n',
				} as MockRule,
			]),
		]);

		const result = getDicePoolConsumers(actor, createFuryPool());
		expect(result.map((c) => c.itemName)).toEqual(['Alpha Strike', 'Zeta Strike']);
	});
});
