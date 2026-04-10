import { beforeEach, describe, expect, it } from 'vitest';
import { normalizeDamageRollFormula } from './normalizeDamageRollFormula.js';

/**
 * The mock Roll.validate in tests always returns true, which masks bugs.
 * These tests use a more realistic validate that rejects obviously invalid syntax
 * to match production behavior where Foundry's parser rejects malformed formulas.
 */

// A simple formula validator that catches the corruption patterns we care about.
// Not a full Foundry parser, but catches "))1d12" and similar invalid syntax.
function realisticValidate(formula: string): boolean {
	const trimmed = formula.trim();
	if (!trimmed) return false;

	// Reject ")[digit]" — no operator between closing paren and number
	if (/\)\d/.test(trimmed)) return false;

	// Reject unclosed/unbalanced parentheses
	let depth = 0;
	for (const ch of trimmed) {
		if (ch === '(') depth++;
		if (ch === ')') depth--;
		if (depth < 0) return false;
	}
	if (depth !== 0) return false;

	return true;
}

describe('normalizeDamageRollFormula', () => {
	beforeEach(() => {
		// Override Roll.validate with realistic behavior
		const MockRoll = (
			globalThis as unknown as { foundry: { dice: { Roll: { validate: (f: string) => boolean } } } }
		).foundry.dice.Roll;
		MockRoll.validate = realisticValidate;
	});

	describe('basic formulas (should pass through unchanged)', () => {
		it('should preserve simple dice formulas', () => {
			expect(normalizeDamageRollFormula('1d6')).toBe('1d6');
		});

		it('should preserve dice + flat bonus', () => {
			expect(normalizeDamageRollFormula('1d6+3')).toBe('1d6+3');
		});

		it('should preserve multi-die formulas', () => {
			expect(normalizeDamageRollFormula('2d8+1d6')).toBe('2d8+1d6');
		});
	});

	describe('OCR typo fixing (the original purpose)', () => {
		it('should fix O as 0 in dice faces', () => {
			expect(normalizeDamageRollFormula('1dO')).toBe('1d0');
		});

		it('should fix l (OCR artifact) in dice faces by stripping it', () => {
			expect(normalizeDamageRollFormula('1dl2')).toBe('1d2');
		});
	});

	describe('@variable references', () => {
		it('should preserve @key in a simple formula', () => {
			const result = normalizeDamageRollFormula('1d12+@key');
			expect(result).toBe('1d12+@key');
		});

		it('should preserve @level in a formula', () => {
			const result = normalizeDamageRollFormula('1d6+@level');
			expect(result).toBe('1d6+@level');
		});

		it('should preserve @key in frost-shield formula (2*@key)', () => {
			const result = normalizeDamageRollFormula('2*@key');
			expect(result).toBe('2*@key');
		});

		it('should preserve @key in shadow-blast formula', () => {
			const result = normalizeDamageRollFormula('1d12+@key + (floor(@level / 5))d12');
			expect(result).toContain('@key');
		});

		it('should preserve the full shadow-blast formula structure', () => {
			const result = normalizeDamageRollFormula('1d12+@key + (floor(@level / 5))d12');
			expect(result).toBe('1d12+@key + (floor(@level / 5))d12');
		});
	});

	describe('computed dice counts', () => {
		it('should not corrupt (expr)dN patterns', () => {
			const result = normalizeDamageRollFormula('(floor(@level / 5))d12');
			expect(result).toBe('(floor(@level / 5))d12');
		});

		it('should not insert "1" before d when preceded by closing paren', () => {
			const result = normalizeDamageRollFormula('(@level)d6');
			expect(result).toBe('(@level)d6');
		});
	});

	describe('edge cases', () => {
		it('should return "0" for empty string', () => {
			expect(normalizeDamageRollFormula('')).toBe('0');
		});

		it('should return "0" for null', () => {
			expect(normalizeDamageRollFormula(null)).toBe('0');
		});

		it('should return "0" for undefined', () => {
			expect(normalizeDamageRollFormula(undefined)).toBe('0');
		});

		it('should normalize whitespace', () => {
			expect(normalizeDamageRollFormula('  1d6  +  3  ')).toBe('1d6 + 3');
		});
	});
});
