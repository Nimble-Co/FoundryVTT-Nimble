import { describe, expect, it } from 'vitest';
import { Predicate } from '../../../etc/Predicate.js';
import { InitiativeManaRerollOnesRule } from '../initiativeManaRerollOnes.js';

function make(
	data: object,
	parent: object = { isEmbedded: true, name: 'Feature', uuid: 'Item.f' },
) {
	const rule = new InitiativeManaRerollOnesRule(
		{ type: 'initiativeManaRerollOnes' } as never,
		{ parent, strict: false } as never,
	);
	Object.assign(rule, { predicate: new Predicate({}), ...data });
	Object.defineProperty(rule, 'item', { get: () => parent, configurable: true });
	return rule;
}

describe('Initiative Mana: Reroll Ones rule', () => {
	it('names the feature for the tag', () => {
		expect(make({ label: 'Steady' }).rerollFeature).toBe('Steady');
		expect(make({ label: '' }).rerollFeature).toBe('Feature');
	});

	it('is off when its condition does not hold', () => {
		expect(make({ test: () => false }).rerollFeature).toBeNull();
	});
});
