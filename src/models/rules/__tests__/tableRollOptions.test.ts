import { describe, expect, it } from 'vitest';
import { Predicate } from '../../../etc/Predicate.js';
import { TableRollOptionsRule } from '../tableRollOptions.js';

function make(
	data: object,
	parent: object = { isEmbedded: true, name: 'Feature', uuid: 'Item.f' },
) {
	const rule = new TableRollOptionsRule(
		{ type: 'tableRollOptions' } as never,
		{ parent, strict: false } as never,
	);
	Object.assign(rule, { predicate: new Predicate({}), ...data });
	Object.defineProperty(rule, 'parent', { get: () => parent, configurable: true });
	return rule;
}

describe('Table Roll Options rule', () => {
	it('changes the rolls on the Chaos Table by default', () => {
		const table = TableRollOptionsRule.defineSchema().table;
		expect(table.initial).toBe('chaos');
		expect(Object.keys(table.choices as Record<string, string>)).toEqual(['chaos']);
	});

	it('applies on a held item with its condition', () => {
		expect(make({}).applies).toBe(true);
		expect(make({}, { isEmbedded: false }).applies).toBe(false);
		expect(make({ test: () => false }).applies).toBe(false);
	});
});
