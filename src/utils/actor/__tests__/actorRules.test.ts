import { describe, expect, it } from 'vitest';

import { ruleKey, ruleLabel, rulesOfType } from '../actorRules.js';

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

describe('rulesOfType', () => {
	it('gives the rules of one type, in order', () => {
		const reroll = { type: 'reroll', id: 'a' };
		const note = { type: 'note', id: 'b' };
		const second = { type: 'reroll', id: 'c' };
		const actor = {
			rules: new Map([
				['a', reroll],
				['b', note],
				['c', second],
			]).values(),
		};

		expect(rulesOfType(actor, 'reroll')).toEqual([reroll, second]);
	});

	it('gives none for an actor with no rules', () => {
		expect(rulesOfType(null, 'reroll')).toEqual([]);
		expect(rulesOfType({}, 'note')).toEqual([]);
	});
});
