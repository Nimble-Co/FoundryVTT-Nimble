import { describe, expect, it } from 'vitest';
import { resourceCostsOfUse } from '../../../utils/cost/itemResourceCosts.js';
import { ResourceCostRule } from '../resourceCost.js';

describe('ResourceCostRule', () => {
	it('asks for the resource, the spend mode and the amount', () => {
		const schema = ResourceCostRule.defineSchema() as any;

		expect(schema.kind.choices()).toEqual({
			mana: 'NIMBLE.rules.resourceCost.kind.choices.mana',
			hp: 'NIMBLE.rules.resourceCost.kind.choices.hp',
			tempHp: 'NIMBLE.rules.resourceCost.kind.choices.tempHp',
			wounds: 'NIMBLE.rules.resourceCost.kind.choices.wounds',
		});
		expect(schema.spendMode.initial).toBe('fixed');
		expect(schema.amount.options.label).toBe('NIMBLE.rules.resourceCost.amount.label');
		expect(schema.amount.initial).toBe('1');
	});

	it('sits with the resource rules and needs an item', () => {
		expect(ResourceCostRule.group).toBe('resource');
		expect(ResourceCostRule.description).toBe('NIMBLE.rules.resourceCost.description');
		expect(ResourceCostRule.worksOnEffects).toBe(false);
	});
});

describe('ResourceCostRule variable mode', () => {
	it('offers a variable mode, with a minimum and a maximum shown only for it', () => {
		const schema = ResourceCostRule.defineSchema() as any;

		expect(Object.keys(schema.spendMode.choices())).toEqual(['fixed', 'variable']);
		for (const field of ['min', 'max']) {
			expect(schema[field].options.showWhen({ spendMode: 'variable' })).toBe(true);
			expect(schema[field].options.showWhen({ spendMode: 'fixed' })).toBe(false);
		}
		expect(schema.amount.options.showWhen({ spendMode: 'variable' })).toBe(false);
	});
});

describe('the costs of a use, read from the rules of the item', () => {
	interface Holder {
		name: string;
		actor: { getRollData: () => Record<string, unknown>; getDomain: () => Set<string> } | null;
		getDomain: () => Set<string>;
		rules?: Map<string, ResourceCostRule>;
	}

	function costRule(item: Holder, id: string, amount: string, passes = true) {
		const rule = new ResourceCostRule({ type: 'resourceCost' } as never, { strict: false });
		Object.assign(rule, { id, type: 'resourceCost', disabled: false, kind: 'mana', amount });
		Object.defineProperty(rule, 'parent', { get: () => item, configurable: true });
		Object.defineProperty(rule, 'predicate', {
			get: () => ({ size: passes ? 0 : 1, test: () => passes }),
			configurable: true,
		});
		return rule;
	}

	function itemWith(actor: Holder['actor'], ...rules: Array<[string, string, boolean?]>) {
		const item: Holder = { name: 'Surge', actor, getDomain: () => new Set<string>() };
		item.rules = new Map(
			rules.map(([id, amount, passes]) => [id, costRule(item, id, amount, passes)]),
		);
		return item;
	}

	const hero = { getRollData: () => ({ will: 3 }), getDomain: () => new Set<string>() };

	it('reads the amount against the roll data of the creature that holds the item', () => {
		expect(resourceCostsOfUse(itemWith(hero, ['a', '@will']) as never)).toEqual([
			expect.objectContaining({ kind: 'mana', amount: 3, source: 'Surge', id: 'a' }),
		]);
	});

	it('reads a number on an item that no creature holds', () => {
		expect(resourceCostsOfUse(itemWith(null, ['a', '2']) as never)).toEqual([
			expect.objectContaining({ amount: 2, id: 'a' }),
		]);
	});

	it('leaves out a disabled rule', () => {
		const item = itemWith(hero, ['a', '2']);
		Object.assign(item.rules?.get('a') ?? {}, { disabled: true });
		expect(resourceCostsOfUse(item as never)).toEqual([]);
	});

	it('leaves out a rule whose predicate fails', () => {
		expect(resourceCostsOfUse(itemWith(hero, ['a', '2', false]) as never)).toEqual([]);
	});

	it('gives one cost for each rule, in order', () => {
		const costs = resourceCostsOfUse(itemWith(hero, ['a', '2'], ['b', '1']) as never);
		expect(costs.map(({ id, amount }) => [id, amount])).toEqual([
			['a', 2],
			['b', 1],
		]);
	});
});

describe('the source of a cost', () => {
	function sourceOf(item: object) {
		const rule = new ResourceCostRule({ type: 'resourceCost' } as never, { strict: false });
		Object.assign(rule, { id: 'a', kind: 'mana', amount: '1' });
		Object.defineProperty(rule, 'parent', { get: () => item, configurable: true });
		return rule.resourceCost.source;
	}

	it('is the unidentified name while an object is unidentified', () => {
		const system = { identified: false, unidentifiedName: 'Strange Ring' };
		expect(sourceOf({ name: 'Ring of Fire', type: 'object', actor: null, system })).toBe(
			'Strange Ring',
		);
	});

	it('is the real name once the object is identified', () => {
		const system = { identified: true, unidentifiedName: 'Strange Ring' };
		expect(sourceOf({ name: 'Ring of Fire', type: 'object', actor: null, system })).toBe(
			'Ring of Fire',
		);
	});
});
