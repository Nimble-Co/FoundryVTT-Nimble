import { describe, expect, it } from 'vitest';
import { stepFormulaDieSize } from './stepFormulaDieSize.js';

describe('stepFormulaDieSize', () => {
	describe('Stepping', () => {
		it('should step a die one place up the chain', () => {
			expect(stepFormulaDieSize('1d6', 1, null)).toBe('1d8');
		});

		it('should walk the full chain one step at a time', () => {
			expect(stepFormulaDieSize('1d4', 1, null)).toBe('1d6');
			expect(stepFormulaDieSize('1d8', 1, null)).toBe('1d10');
			expect(stepFormulaDieSize('1d10', 1, null)).toBe('1d12');
			expect(stepFormulaDieSize('1d12', 1, null)).toBe('1d20');
		});

		it('should apply multiple steps at once', () => {
			expect(stepFormulaDieSize('1d6', 3, null)).toBe('1d12');
		});

		it('should preserve the die count', () => {
			expect(stepFormulaDieSize('3d6', 1, null)).toBe('3d8');
		});

		it('should preserve a die term with an implicit count', () => {
			expect(stepFormulaDieSize('d6+2', 1, null)).toBe('d8+2');
		});

		it('should preserve the rest of the formula', () => {
			expect(stepFormulaDieSize('1d6+@abilities.wil.mod', 1, null)).toBe('1d8+@abilities.wil.mod');
		});

		it('should step every die term in the formula', () => {
			expect(stepFormulaDieSize('1d6+2d8', 1, null)).toBe('1d8+2d10');
		});
	});

	describe('Maximum die size', () => {
		it('should not step past the cap', () => {
			expect(stepFormulaDieSize('1d10', 5, 12)).toBe('1d12');
		});

		it('should leave a die that already meets the cap untouched', () => {
			expect(stepFormulaDieSize('1d12', 1, 12)).toBe('1d12');
		});

		it('should leave a die that already exceeds the cap untouched', () => {
			expect(stepFormulaDieSize('1d20', 1, 12)).toBe('1d20');
		});

		it('should stop at d20 when uncapped', () => {
			expect(stepFormulaDieSize('1d6', 10, null)).toBe('1d20');
		});

		it('should honour a raised cap', () => {
			expect(stepFormulaDieSize('1d12', 1, 20)).toBe('1d20');
		});
	});

	describe('Edge cases', () => {
		it('should return the formula unchanged for zero or negative steps', () => {
			expect(stepFormulaDieSize('1d6', 0, null)).toBe('1d6');
			expect(stepFormulaDieSize('1d6', -1, null)).toBe('1d6');
		});

		it('should return an empty formula unchanged', () => {
			expect(stepFormulaDieSize('', 1, null)).toBe('');
		});

		it('should leave dice outside the standard chain untouched', () => {
			expect(stepFormulaDieSize('1d3+1d100', 1, null)).toBe('1d3+1d100');
		});

		it('should not treat a roll-data path segment as a die term', () => {
			expect(stepFormulaDieSize('@attributes.hitDice.d8.current', 1, null)).toBe(
				'@attributes.hitDice.d8.current',
			);
		});

		it('should leave a formula with no dice untouched', () => {
			expect(stepFormulaDieSize('5+@abilities.wil.mod', 1, null)).toBe('5+@abilities.wil.mod');
		});
	});
});
