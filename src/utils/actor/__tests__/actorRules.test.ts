import { describe, expect, it } from 'vitest';

import { ruleKey, ruleLabel } from '../actorRules.js';

describe('ruleLabel', () => {
	it('gives the rule label when it has one', () => {
		expect(ruleLabel({ label: 'Strike', item: { name: 'Feature' } })).toBe('Strike');
	});

	it('gives the item name when the label is empty', () => {
		expect(ruleLabel({ label: '', item: { name: 'Feature' } })).toBe('Feature');
	});

	it('gives an empty string with no label and no item name', () => {
		expect(ruleLabel({ label: '', item: { name: null } })).toBe('');
		expect(ruleLabel({ item: null })).toBe('');
	});
});

describe('ruleKey', () => {
	it('joins the item uuid and the rule id', () => {
		expect(ruleKey({ id: 'rule1', item: { uuid: 'Actor.a.Item.b' } })).toBe('Actor.a.Item.b:rule1');
	});

	it('uses an empty part for a missing uuid or id', () => {
		expect(ruleKey({ id: 'rule1', item: null })).toBe(':rule1');
		expect(ruleKey({ id: null, item: { uuid: 'Item.b' } })).toBe('Item.b:');
	});
});
