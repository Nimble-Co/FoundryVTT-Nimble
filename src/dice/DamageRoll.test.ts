import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DamageRoll } from './DamageRoll.js';

describe('DamageRoll preprocessing', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('Primary die extraction (attacks with canCrit or canMiss)', () => {
		it('should extract primary die from single die formula', () => {
			const roll = new DamageRoll('1d6', {}, { canCrit: true, canMiss: true, rollMode: 0 });

			expect(roll.formula).toBe('1d6x');
			expect(roll.primaryDie).toBeDefined();
		});

		it('should extract primary die from multi-die formula', () => {
			const roll = new DamageRoll('2d6', {}, { canCrit: true, canMiss: true, rollMode: 0 });

			// 2d6 becomes: 1d6x (primary) + 1d6 (damage)
			expect(roll.formula).toBe('1d6x + 1d6');
			expect(roll.primaryDie).toBeDefined();
		});

		it('should apply advantage to primary die only', () => {
			const roll = new DamageRoll('2d6', {}, { canCrit: true, canMiss: true, rollMode: 1 });

			// Primary die gets advantage (2d6kh), rest stays as damage
			// 2d6 with advantage → 2d6khx (primary) + 1d6 (damage)
			expect(roll.formula).toBe('2d6khx + 1d6');
			expect(roll.primaryDie).toBeDefined();
			expect(roll.primaryDie?.number).toBe(2);
		});

		it('should apply disadvantage to primary die only', () => {
			const roll = new DamageRoll('2d6', {}, { canCrit: true, canMiss: true, rollMode: -1 });

			// Primary die gets disadvantage (2d6kl), rest stays as damage
			expect(roll.formula).toBe('2d6klx + 1d6');
			expect(roll.primaryDie).toBeDefined();
			expect(roll.primaryDie?.number).toBe(2);
		});

		it('should apply multiple levels of advantage to primary die', () => {
			const roll = new DamageRoll('1d8', {}, { canCrit: true, canMiss: true, rollMode: 2 });

			// 1d8 with advantage 2 → 3d8khx (roll 3, keep 1)
			expect(roll.formula).toBe('3d8khx');
			expect(roll.primaryDie?.number).toBe(3);
		});

		it('should add explosion modifier when canCrit is true', () => {
			const roll = new DamageRoll('1d6', {}, { canCrit: true, canMiss: false, rollMode: 0 });

			expect(roll.formula).toBe('1d6x');
		});

		it('should not add explosion modifier when canCrit is false', () => {
			const roll = new DamageRoll('1d6', {}, { canCrit: false, canMiss: true, rollMode: 0 });

			expect(roll.formula).toBe('1d6');
			expect(roll.primaryDie).toBeDefined();
		});
	});

	describe('AoE advantage/disadvantage (no primary die)', () => {
		it('should apply advantage to entire first die term for AoE', () => {
			const roll = new DamageRoll('2d8', {}, { canCrit: false, canMiss: false, rollMode: 1 });

			// 2d8 with advantage → 3d8kh2 (roll 3, keep highest 2)
			expect(roll.formula).toBe('3d8kh2');
			expect(roll.primaryDie).toBeUndefined();
		});

		it('should apply disadvantage to entire first die term for AoE', () => {
			const roll = new DamageRoll('2d8', {}, { canCrit: false, canMiss: false, rollMode: -1 });

			// 2d8 with disadvantage → 3d8kl2 (roll 3, keep lowest 2)
			expect(roll.formula).toBe('3d8kl2');
			expect(roll.primaryDie).toBeUndefined();
		});

		it('should apply advantage to single die AoE', () => {
			const roll = new DamageRoll('1d8', {}, { canCrit: false, canMiss: false, rollMode: 1 });

			// 1d8 with advantage → 2d8kh (roll 2, keep 1)
			expect(roll.formula).toBe('2d8kh');
			expect(roll.primaryDie).toBeUndefined();
		});

		it('should apply multiple levels of advantage to AoE', () => {
			const roll = new DamageRoll('2d6', {}, { canCrit: false, canMiss: false, rollMode: 2 });

			// 2d6 with advantage 2 → 4d6kh2 (roll 4, keep highest 2)
			expect(roll.formula).toBe('4d6kh2');
		});

		it('should apply multiple levels of disadvantage to AoE', () => {
			const roll = new DamageRoll('3d6', {}, { canCrit: false, canMiss: false, rollMode: -2 });

			// 3d6 with disadvantage 2 → 5d6kl3 (roll 5, keep lowest 3)
			expect(roll.formula).toBe('5d6kl3');
		});

		it('should preserve formula modifiers for AoE with advantage', () => {
			const roll = new DamageRoll('2d8 + 4', {}, { canCrit: false, canMiss: false, rollMode: 1 });

			// 2d8 + 4 with advantage → 3d8kh2 + 4
			expect(roll.formula).toBe('3d8kh2 + 4');
		});
	});

	describe('No processing needed', () => {
		it('should not modify formula when canCrit=false, canMiss=false, rollMode=0', () => {
			const roll = new DamageRoll('2d8', {}, { canCrit: false, canMiss: false, rollMode: 0 });

			expect(roll.formula).toBe('2d8');
			expect(roll.primaryDie).toBeUndefined();
		});

		it('should not modify formula with modifiers when no processing needed', () => {
			const roll = new DamageRoll('2d8 + 5', {}, { canCrit: false, canMiss: false, rollMode: 0 });

			expect(roll.formula).toBe('2d8 + 5');
		});
	});

	describe('Edge cases', () => {
		it('should handle formula with only numeric terms', () => {
			const roll = new DamageRoll('5', {}, { canCrit: false, canMiss: false, rollMode: 1 });

			// No die term to modify
			expect(roll.formula).toBe('5');
		});

		it('should set isCritical to false when canCrit is false', () => {
			const roll = new DamageRoll('2d8', {}, { canCrit: false, canMiss: false, rollMode: 0 });

			expect(roll.isCritical).toBe(false);
		});

		it('should set isMiss to false when canMiss is false', () => {
			const roll = new DamageRoll('2d8', {}, { canCrit: false, canMiss: false, rollMode: 0 });

			expect(roll.isMiss).toBe(false);
		});
	});
});

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

			expect(roll._formula).toBe('1d6');
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

			// When terms array is empty, formula is parsed from the formula string
			expect(roll._formula).toBe('1d6');
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

			// Foundry adds spaces around operators when reconstructing formulas
			expect(roll._formula).toBe('1d6 + 2');
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
			expect(roll.options).toEqual({
				canCrit: true,
				canMiss: true,
				rollMode: 0,
				primaryDieAsDamage: true,
			});
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

			// Foundry adds spaces around operators when reconstructing formulas
			expect(roll.formula).toBe('1d6 + 2');
			expect(roll.data).toEqual({ level: 3 });
			expect(roll.options).toEqual({
				canCrit: true,
				canMiss: true,
				rollMode: 1,
				primaryDieAsDamage: true,
			});
		});
	});
});
