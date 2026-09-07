import { describe, expect, it } from 'vitest';
import { getSpellManaCost } from './getSpellManaCost.js';

describe('getSpellManaCost', () => {
	it('costs a tiered spell its tier in mana', () => {
		expect(getSpellManaCost({ tier: 3 })).toBe(3);
	});

	it('costs nothing for a cantrip', () => {
		expect(getSpellManaCost({ tier: 0 })).toBe(0);
	});

	it('costs nothing when the tier is missing', () => {
		expect(getSpellManaCost({})).toBe(0);
	});
});
