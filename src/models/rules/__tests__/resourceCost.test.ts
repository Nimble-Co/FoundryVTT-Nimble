import { describe, expect, it } from 'vitest';
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
