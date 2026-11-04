import { describe, expect, it } from 'vitest';
import { damageMultiplierOf } from '../../../utils/damage/damageMultiplier.js';

describe('damageMultiplierOf', () => {
	const rule = { type: 'damageMultiplier', label: 'Sure Shot', multiplier: 3, disabled: false };

	it('gives the tick of the rule on the item', () => {
		expect(damageMultiplierOf({ rules: new Map([['0', rule]]) })).toMatchObject({
			label: 'Sure Shot',
			multiplier: 3,
		});
	});

	it('gives nothing with no rule, or with a disabled rule', () => {
		expect(damageMultiplierOf({ rules: new Map() })).toBeNull();
		expect(damageMultiplierOf({ rules: new Map([['0', { ...rule, disabled: true }]]) })).toBeNull();
	});
});
