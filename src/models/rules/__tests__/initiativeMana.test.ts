import { describe, expect, it } from 'vitest';
import { Predicate } from '../../../etc/Predicate.js';
import { InitiativeManaRule } from '../initiativeMana.js';

function make(
	data: object,
	parent: object = { isEmbedded: true, name: 'Feature', uuid: 'Item.f' },
) {
	const rule = new InitiativeManaRule(
		{ type: 'initiativeMana' } as never,
		{ parent, strict: false } as never,
	);
	Object.assign(rule, { predicate: new Predicate({}), ...data });
	Object.defineProperty(rule, 'parent', { get: () => parent, configurable: true });
	return rule;
}

describe('Initiative Mana rule', () => {
	it('gives the flat formula and the dice', () => {
		const rule = make({ flat: '3', dice: ' 1d4 ', resolveFormula: () => 3, label: 'Surge' });

		expect(rule.initiativeManaSpec).toEqual({ feature: 'Surge', flat: 3, dice: '1d4' });
	});

	it('gives nothing on an item that no hero holds', () => {
		const rule = make({ flat: '3' }, { isEmbedded: false });

		expect(rule.initiativeManaSpec).toBeNull();
	});

	it('gives nothing when its condition does not hold', () => {
		const rule = make({ flat: '3', test: () => false });

		expect(rule.initiativeManaSpec).toBeNull();
	});
});
