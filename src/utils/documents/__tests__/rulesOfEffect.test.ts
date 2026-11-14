import { describe, expect, it } from 'vitest';
import { rulesOfEffect } from '../rulesOfEffect.js';

describe('rulesOfEffect', () => {
	it('reads the prepared rules when the effect has them', () => {
		const prepared = { type: 'zeroHpAtEnd', prepared: true };
		const effect = {
			rules: new Map([['a', prepared]]),
			system: { rules: [{ type: 'zeroHpAtEnd' }] },
		};

		expect(rulesOfEffect(effect)).toEqual([prepared]);
	});

	it('reads the rule data when the effect has no prepared rules', () => {
		const source = { type: 'saveOnEvent' };

		expect(rulesOfEffect({ system: { rules: [source] } })).toEqual([source]);
	});

	it('is empty with no rules, or rule data that is not a list', () => {
		expect(rulesOfEffect({})).toEqual([]);
		expect(rulesOfEffect({ system: {} })).toEqual([]);
		expect(rulesOfEffect({ system: { rules: 'broken' } })).toEqual([]);
	});
});
