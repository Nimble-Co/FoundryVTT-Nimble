import { describe, expect, it } from 'vitest';

import { displayFormula } from '../displayFormula.ts';

describe('displayFormula', () => {
	it('works out a dice count in parentheses', () => {
		expect(displayFormula('(2 + floor(0 / 5))d12')).toBe('2d12');
		expect(displayFormula('(2)d8')).toBe('2d8');
		expect(displayFormula('(2 + floor(@level / 5))d12', { level: 10 })).toBe('4d12');
	});

	it('puts in roll data, and pool ids with a hyphen', () => {
		expect(
			displayFormula('1d@pools.combat-dice.faces', { pools: { 'combat-dice': { faces: 8 } } }),
		).toBe('1d8');
		expect(displayFormula('(@strength)d8', { strength: 2 })).toBe('2d8');
	});

	it('shows a product of dice as "X × N"', () => {
		expect(displayFormula('1d6*2')).toBe('1d6 × 2');
		expect(displayFormula('(1d6)*2')).toBe('1d6 × 2');
		expect(displayFormula('(1d6 + 2)*2')).toBe('(1d6 + 2) × 2');
	});

	it('drops flavor labels', () => {
		expect(displayFormula('1d8+1d8*2[Using Lunging Strike (+1 Reach)]')).toBe('1d8 + 1d8 × 2');
		expect(displayFormula('1d8+5[Fury Dice]')).toBe('1d8 + 5');
	});

	it('works out plain arithmetic', () => {
		expect(displayFormula('2 * 2')).toBe('4');
		expect(displayFormula('1d8 + (2 * 2)')).toBe('1d8 + 4');
		expect(displayFormula('1d8 + -2')).toBe('1d8 - 2');
	});

	it('keeps dice modifiers', () => {
		expect(displayFormula('2d20kh + 3')).toBe('2d20kh + 3');
	});

	it('gives back a formula it cannot read with only the labels taken out', () => {
		expect(displayFormula('1d8 + @missing.value')).toBe('1d8 + @missing.value');
		expect(displayFormula('')).toBe('');
	});
});
