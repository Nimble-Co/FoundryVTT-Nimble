import { describe, expect, it } from 'vitest';
import { Predicate } from '../../../etc/Predicate.js';
import { TableRollRule } from '../tableRoll.js';

function make(
	data: object,
	parent: object = { isEmbedded: true, name: 'Feature', uuid: 'Item.f' },
) {
	const rule = new TableRollRule(
		{ type: 'tableRoll' } as never,
		{ parent, strict: false } as never,
	);
	Object.assign(rule, { predicate: new Predicate({}), ...data });
	Object.defineProperty(rule, 'item', { get: () => parent, configurable: true });
	return rule;
}

describe('Table Roll rule', () => {
	it('rolls on the Chaos Table by default', () => {
		expect(TableRollRule.defineSchema().table.initial).toBe('chaos');
	});

	it('rolls on the less mana tick or a crit by default, or when its item is used', () => {
		const when = TableRollRule.defineSchema().when;
		expect(when.initial).toBe('lessManaOrCrit');
		expect(Object.keys(when.choices as Record<string, string>)).toEqual([
			'lessManaOrCrit',
			'onUse',
		]);
	});

	it('lets the holder invoke Chaos', () => {
		expect(make({}).invokesChaos).toBe(true);
	});

	it('does not on an item that no hero holds', () => {
		expect(make({}, { isEmbedded: false }).invokesChaos).toBe(false);
	});

	it('does not when its condition does not hold', () => {
		expect(make({ test: () => false }).invokesChaos).toBe(false);
	});
});
