import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ruleKey, ruleLabel, rulesOfType, runningRule } from '../actorRules.js';

describe('ruleLabel', () => {
	it('gives the rule label when it has one', () => {
		expect(ruleLabel({ label: 'Strike', parentDocument: { name: 'Feature' } })).toBe('Strike');
	});

	it('gives the item name when the label is empty', () => {
		expect(ruleLabel({ label: '', parentDocument: { name: 'Feature' } })).toBe('Feature');
	});

	it('gives an empty string with no label and no item name', () => {
		expect(ruleLabel({ label: '', parentDocument: { name: null } })).toBe('');
		expect(ruleLabel({ parentDocument: null })).toBe('');
	});
});

describe('ruleKey', () => {
	it('joins the item uuid and the rule id', () => {
		expect(ruleKey({ id: 'rule1', parentDocument: { uuid: 'Actor.a.Item.b' } })).toBe(
			'Actor.a.Item.b:rule1',
		);
	});

	it('uses an empty part for a missing uuid or id', () => {
		expect(ruleKey({ id: 'rule1', parentDocument: null })).toBe(':rule1');
		expect(ruleKey({ id: null, parentDocument: { uuid: 'Item.b' } })).toBe('Item.b:');
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

describe('runningRule', () => {
	const globals = globalThis as { fromUuidSync?: unknown };
	let previous: unknown;
	let documents: Record<string, unknown>;

	beforeEach(() => {
		previous = globals.fromUuidSync;
		documents = {};
		globals.fromUuidSync = (uuid: string) => documents[uuid] ?? null;
	});

	afterEach(() => {
		globals.fromUuidSync = previous;
	});

	const rulesWith = (...rules: { id: string; disabled?: boolean }[]) =>
		new Map(rules.map((rule) => [rule.id, rule]));

	it('finds a rule on an item by the item uuid and the rule id', () => {
		documents['Item.a'] = { documentName: 'Item', rules: rulesWith({ id: 'r1' }) };

		expect(runningRule('Item.a', 'r1')).toEqual({ id: 'r1' });
		expect(runningRule('Item.a', 'r2')).toBeNull();
	});

	it('finds a rule on an effect only while the effect changes its actor', () => {
		const effect = {
			documentName: 'ActiveEffect',
			modifiesActor: true,
			rules: rulesWith({ id: 'r1' }),
		};
		documents['Actor.a.ActiveEffect.e'] = effect;

		expect(runningRule('Actor.a.ActiveEffect.e', 'r1')).toEqual({ id: 'r1' });
		effect.modifiesActor = false;
		expect(runningRule('Actor.a.ActiveEffect.e', 'r1')).toBeNull();
	});

	it('finds no rule that is disabled, and nothing with no uuid', () => {
		documents['Item.a'] = { documentName: 'Item', rules: rulesWith({ id: 'r1', disabled: true }) };

		expect(runningRule('Item.a', 'r1')).toBeNull();
		expect(runningRule('', 'r1')).toBeNull();
	});
});
