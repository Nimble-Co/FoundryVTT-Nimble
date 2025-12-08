import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DamageRoll } from './DamageRoll.js';

describe('DamageRoll.fromData', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('Basic functionality', () => {
		it('should create a DamageRoll instance from data', () => {
			const data = {
				formula: '1d6',
				data: {},
				options: {},
				terms: [],
				originalFormula: '1d6',
			};

			const roll = DamageRoll.fromData(data);

			expect(roll.formula).toBe('1d6');
			expect(roll.originalFormula).toBe('1d6');
			expect(roll).toHaveProperty('originalFormula');
		});

		it('should set originalFormula from data', () => {
			const data = {
				formula: '1d6+2',
				data: {},
				options: {},
				terms: [],
				originalFormula: '1d6+2',
			};

			const roll = DamageRoll.fromData(data);

			expect(roll.originalFormula).toBe('1d6+2');
		});

		it('should set _formula using getFormula with terms', () => {
			const mockTerms = [
				{ number: 1, faces: 6, constructor: { name: 'DieTerm' }, operator: undefined, options: {} },
			];
			const data = {
				formula: '1d6',
				data: {},
				options: {},
				terms: mockTerms,
				originalFormula: '1d6',
			};

			const roll = DamageRoll.fromData(data);

			expect((roll as object as { _formula: string })._formula).toBe('1d6');
		});
	});

	describe('isCritical property', () => {
		it('should set isCritical from top-level data when evaluated is true', () => {
			const data = {
				formula: '1d6',
				data: {},
				options: {},
				terms: [],
				originalFormula: '1d6',
				evaluated: true,
				isCritical: true,
			};

			const roll = DamageRoll.fromData(data);

			expect(roll.isCritical).toBe(true);
		});

		it('should set isCritical from top-level data when evaluated is undefined (defaults to true)', () => {
			const data = {
				formula: '1d6',
				data: {},
				options: {},
				terms: [],
				originalFormula: '1d6',
				isCritical: false,
			};

			const roll = DamageRoll.fromData(data);

			expect(roll.isCritical).toBe(false);
		});

		it('should set isCritical from options when not in top-level data and evaluated is true', () => {
			const data = {
				formula: '1d6',
				data: {},
				options: {
					isCritical: true,
				},
				terms: [],
				originalFormula: '1d6',
				evaluated: true,
			};

			const roll = DamageRoll.fromData(data);

			expect(roll.isCritical).toBe(true);
		});

		it('should prioritize top-level isCritical over options.isCritical', () => {
			const data = {
				formula: '1d6',
				data: {},
				options: {
					isCritical: false,
				},
				terms: [],
				originalFormula: '1d6',
				evaluated: true,
				isCritical: true,
			};

			const roll = DamageRoll.fromData(data);

			expect(roll.isCritical).toBe(true);
		});

		it('should not set isCritical when evaluated is false', () => {
			const data = {
				formula: '1d6',
				data: {},
				options: {
					isCritical: true,
				},
				terms: [],
				originalFormula: '1d6',
				evaluated: false,
				isCritical: true,
			};

			const roll = DamageRoll.fromData(data);

			expect(roll.isCritical).toBeUndefined();
		});

		it('should set isCritical to undefined when not provided in data or options', () => {
			const data = {
				formula: '1d6',
				data: {},
				options: {},
				terms: [],
				originalFormula: '1d6',
				evaluated: true,
			};

			const roll = DamageRoll.fromData(data);

			expect(roll.isCritical).toBeUndefined();
		});

		it('should handle isCritical as false from top-level data', () => {
			const data = {
				formula: '1d6',
				data: {},
				options: {},
				terms: [],
				originalFormula: '1d6',
				evaluated: true,
				isCritical: false,
			};

			const roll = DamageRoll.fromData(data);

			expect(roll.isCritical).toBe(false);
		});

		it('should handle isCritical as false from options', () => {
			const data = {
				formula: '1d6',
				data: {},
				options: {
					isCritical: false,
				},
				terms: [],
				originalFormula: '1d6',
				evaluated: true,
			};

			const roll = DamageRoll.fromData(data);

			expect(roll.isCritical).toBe(false);
		});
	});

	describe('isMiss property', () => {
		it('should set isMiss from top-level data when evaluated is true', () => {
			const data = {
				formula: '1d6',
				data: {},
				options: {},
				terms: [],
				originalFormula: '1d6',
				evaluated: true,
				isMiss: true,
			};

			const roll = DamageRoll.fromData(data);

			expect(roll.isMiss).toBe(true);
		});

		it('should set isMiss from top-level data when evaluated is undefined (defaults to true)', () => {
			const data = {
				formula: '1d6',
				data: {},
				options: {},
				terms: [],
				originalFormula: '1d6',
				isMiss: false,
			};

			const roll = DamageRoll.fromData(data);

			expect(roll.isMiss).toBe(false);
		});

		it('should set isMiss from options when not in top-level data and evaluated is true', () => {
			const data = {
				formula: '1d6',
				data: {},
				options: {
					isMiss: true,
				},
				terms: [],
				originalFormula: '1d6',
				evaluated: true,
			};

			const roll = DamageRoll.fromData(data);

			expect(roll.isMiss).toBe(true);
		});

		it('should prioritize top-level isMiss over options.isMiss', () => {
			const data = {
				formula: '1d6',
				data: {},
				options: {
					isMiss: false,
				},
				terms: [],
				originalFormula: '1d6',
				evaluated: true,
				isMiss: true,
			};

			const roll = DamageRoll.fromData(data);

			expect(roll.isMiss).toBe(true);
		});

		it('should not set isMiss when evaluated is false', () => {
			const data = {
				formula: '1d6',
				data: {},
				options: {
					isMiss: true,
				},
				terms: [],
				originalFormula: '1d6',
				evaluated: false,
				isMiss: true,
			};

			const roll = DamageRoll.fromData(data);

			expect(roll.isMiss).toBeUndefined();
		});

		it('should set isMiss to undefined when not provided in data or options', () => {
			const data = {
				formula: '1d6',
				data: {},
				options: {},
				terms: [],
				originalFormula: '1d6',
				evaluated: true,
			};

			const roll = DamageRoll.fromData(data);

			expect(roll.isMiss).toBeUndefined();
		});

		it('should handle isMiss as false from top-level data', () => {
			const data = {
				formula: '1d6',
				data: {},
				options: {},
				terms: [],
				originalFormula: '1d6',
				evaluated: true,
				isMiss: false,
			};

			const roll = DamageRoll.fromData(data);

			expect(roll.isMiss).toBe(false);
		});

		it('should handle isMiss as false from options', () => {
			const data = {
				formula: '1d6',
				data: {},
				options: {
					isMiss: false,
				},
				terms: [],
				originalFormula: '1d6',
				evaluated: true,
			};

			const roll = DamageRoll.fromData(data);

			expect(roll.isMiss).toBe(false);
		});
	});

	describe('Combined scenarios', () => {
		it('should set both isCritical and isMiss from top-level data', () => {
			const data = {
				formula: '1d6',
				data: {},
				options: {},
				terms: [],
				originalFormula: '1d6',
				evaluated: true,
				isCritical: true,
				isMiss: false,
			};

			const roll = DamageRoll.fromData(data);

			expect(roll.isCritical).toBe(true);
			expect(roll.isMiss).toBe(false);
		});

		it('should set both isCritical and isMiss from options', () => {
			const data = {
				formula: '1d6',
				data: {},
				options: {
					isCritical: false,
					isMiss: true,
				},
				terms: [],
				originalFormula: '1d6',
				evaluated: true,
			};

			const roll = DamageRoll.fromData(data);

			expect(roll.isCritical).toBe(false);
			expect(roll.isMiss).toBe(true);
		});

		it('should handle mixed sources (isCritical from top-level, isMiss from options)', () => {
			const data = {
				formula: '1d6',
				data: {},
				options: {
					isMiss: true,
				},
				terms: [],
				originalFormula: '1d6',
				evaluated: true,
				isCritical: true,
			};

			const roll = DamageRoll.fromData(data);

			expect(roll.isCritical).toBe(true);
			expect(roll.isMiss).toBe(true);
		});

		it('should handle mixed sources (isCritical from options, isMiss from top-level)', () => {
			const data = {
				formula: '1d6',
				data: {},
				options: {
					isCritical: false,
				},
				terms: [],
				originalFormula: '1d6',
				evaluated: true,
				isMiss: false,
			};

			const roll = DamageRoll.fromData(data);

			expect(roll.isCritical).toBe(false);
			expect(roll.isMiss).toBe(false);
		});

		it('should not set isCritical or isMiss when evaluated is false', () => {
			const data = {
				formula: '1d6',
				data: {},
				options: {
					isCritical: true,
					isMiss: true,
				},
				terms: [],
				originalFormula: '1d6',
				evaluated: false,
				isCritical: true,
				isMiss: true,
			};

			const roll = DamageRoll.fromData(data);

			expect(roll.isCritical).toBeUndefined();
			expect(roll.isMiss).toBeUndefined();
		});
	});

	describe('Edge cases', () => {
		it('should handle null options', () => {
			const data = {
				formula: '1d6',
				data: {},
				options: null,
				terms: [],
				originalFormula: '1d6',
				evaluated: true,
				isCritical: true,
			};

			const roll = DamageRoll.fromData(data);

			expect(roll.isCritical).toBe(true);
			expect(roll.isMiss).toBeUndefined();
		});

		it('should handle undefined options', () => {
			const data = {
				formula: '1d6',
				data: {},
				options: undefined,
				terms: [],
				originalFormula: '1d6',
				evaluated: true,
				isMiss: false,
			};

			const roll = DamageRoll.fromData(data);

			expect(roll.isCritical).toBeUndefined();
			expect(roll.isMiss).toBe(false);
		});

		it('should handle empty terms array', () => {
			const data = {
				formula: '1d6',
				data: {},
				options: {},
				terms: [],
				originalFormula: '1d6',
				evaluated: true,
			};

			const roll = DamageRoll.fromData(data);

			expect((roll as object as { _formula: string })._formula).toBe('');
		});

		it('should handle complex formula with multiple terms', () => {
			const mockTerms = [
				{ number: 1, faces: 6, constructor: { name: 'DieTerm' }, operator: undefined, options: {} },
				{ constructor: { name: 'OperatorTerm' }, operator: '+', options: {} },
				{ number: 2, constructor: { name: 'NumericTerm' }, operator: undefined, options: {} },
			];
			const data = {
				formula: '1d6+2',
				data: {},
				options: {},
				terms: mockTerms,
				originalFormula: '1d6+2',
				evaluated: true,
			};

			const roll = DamageRoll.fromData(data);

			expect((roll as object as { _formula: string })._formula).toBe('1d6+2');
			expect(roll.originalFormula).toBe('1d6+2');
		});

		it('should handle data with additional properties', () => {
			const data = {
				formula: '1d6',
				data: { level: 5, strength: 18 },
				options: { canCrit: true, canMiss: true },
				terms: [],
				originalFormula: '1d6',
				evaluated: true,
				isCritical: true,
				isMiss: false,
				extraProperty: 'should be ignored',
			};

			const roll = DamageRoll.fromData(data);

			expect(roll.formula).toBe('1d6');
			expect(roll.originalFormula).toBe('1d6');
			expect(roll.isCritical).toBe(true);
			expect(roll.isMiss).toBe(false);
		});
	});

	describe('Integration with parent class', () => {
		it('should call parent fromData method', () => {
			const data = {
				formula: '1d6',
				data: { test: 'value' },
				options: { canCrit: true },
				terms: [],
				originalFormula: '1d6',
			};

			const roll = DamageRoll.fromData(data);

			expect(roll.formula).toBe('1d6');
			expect(roll.originalFormula).toBe('1d6');
			expect(roll.data).toEqual({ test: 'value' });
			expect(roll.options).toEqual({ canCrit: true, canMiss: true, rollMode: 0 });
		});

		it('should preserve parent class properties', () => {
			const data = {
				formula: '1d6+2',
				data: { level: 3 },
				options: { canCrit: true, rollMode: 1 },
				terms: [],
				originalFormula: '1d6+2',
				evaluated: true,
			};

			const roll = DamageRoll.fromData(data);

			expect(roll.formula).toBe('1d6+2');
			expect(roll.data).toEqual({ level: 3 });
			expect(roll.options).toEqual({ canCrit: true, canMiss: true, rollMode: 1 });
		});
	});
});
