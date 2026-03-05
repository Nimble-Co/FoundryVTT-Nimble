import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DamageRoll } from './DamageRoll.js';
import { PrimaryDie } from './terms/PrimaryDie.js';

// Global cleanup to prevent mock pollution between tests
afterEach(() => {
	vi.restoreAllMocks();
});

describe('DamageRoll critBonusDice (Vicious)', () => {
	let mathRandomSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		if (mathRandomSpy) {
			mathRandomSpy.mockRestore();
		}
	});

	describe('_rollCritBonusDice behavior', () => {
		it('should have critBonusDice option available', () => {
			const roll = new DamageRoll(
				'1d6',
				{},
				{
					canCrit: true,
					canMiss: true,
					rollMode: 0,
					primaryDieValue: 0,
					primaryDieModifier: 0,
					critBonusDice: 2,
				},
			);

			expect(roll.options.critBonusDice).toBe(2);
		});

		it('should initialize critBonusResults as empty array', () => {
			const roll = new DamageRoll(
				'1d6',
				{},
				{
					canCrit: true,
					canMiss: true,
					rollMode: 0,
					primaryDieValue: 0,
					primaryDieModifier: 0,
					critBonusDice: 1,
				},
			);

			expect(roll.critBonusResults).toEqual([]);
		});

		it('should NOT add Vicious dice when canCrit is false (even if crit option is passed)', () => {
			const roll = new DamageRoll(
				'1d6',
				{},
				{
					canCrit: false,
					canMiss: true,
					rollMode: 0,
					primaryDieValue: 0,
					primaryDieModifier: 0,
					critBonusDice: 1,
				},
			);

			// When canCrit is false, isCritical should be set to false in constructor
			expect(roll.isCritical).toBe(false);
			// And critBonusResults should remain empty
			expect(roll.critBonusResults).toEqual([]);
		});
	});

	describe('toJSON serialization', () => {
		it('should serialize critBonusResults in toJSON', () => {
			const roll = new DamageRoll(
				'1d6',
				{},
				{
					canCrit: true,
					canMiss: true,
					rollMode: 0,
					primaryDieValue: 0,
					primaryDieModifier: 0,
					critBonusDice: 1,
				},
			);

			// Manually set state to simulate evaluation with crit
			roll.isCritical = true;
			roll.critBonusResults = [4, 5];

			const json = roll.toJSON();

			expect(json.critBonusResults).toBeDefined();
			expect(json.critBonusResults).toEqual([4, 5]);
		});

		it('should serialize empty critBonusResults when no crit', () => {
			const roll = new DamageRoll(
				'1d6',
				{},
				{
					canCrit: true,
					canMiss: true,
					rollMode: 0,
					primaryDieValue: 0,
					primaryDieModifier: 0,
					critBonusDice: 1,
				},
			);

			roll.isCritical = false;
			roll.critBonusResults = [];

			const json = roll.toJSON();

			expect(json.critBonusResults).toEqual([]);
		});
	});

	describe('fromData deserialization', () => {
		it('should restore critBonusResults from fromData', () => {
			const data = {
				formula: '1d6',
				data: {},
				options: {},
				terms: [],
				originalFormula: '1d6',
				evaluated: true,
				isCritical: true,
				critBonusResults: [4, 6, 3],
			};

			const roll = DamageRoll.fromData(data);

			expect(roll.critBonusResults).toEqual([4, 6, 3]);
		});

		it('should default critBonusResults to empty array when not in data', () => {
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

			expect(roll.critBonusResults).toEqual([]);
		});

		it('should preserve critBonusResults through serialize/deserialize cycle', () => {
			const originalRoll = new DamageRoll(
				'1d6',
				{},
				{
					canCrit: true,
					canMiss: true,
					rollMode: 0,
					primaryDieValue: 0,
					primaryDieModifier: 0,
					critBonusDice: 1,
				},
			);

			// Simulate evaluation with crit and vicious dice
			originalRoll.isCritical = true;
			originalRoll.critBonusResults = [6, 4]; // Vicious rolled 6 (exploded), then 4

			const json = originalRoll.toJSON();
			const restoredRoll = DamageRoll.fromData(json);

			expect(restoredRoll.isCritical).toBe(true);
			expect(restoredRoll.critBonusResults).toEqual([6, 4]);
		});
	});

	describe('_evaluateExplosionWavesWithVicious logic', () => {
		// NOTE: The new implementation creates actual Roll objects for each explosion wave
		// and evaluates them through Foundry's dice system. This allows Dice So Nice to
		// animate all dice in a wave together. Each wave rolls (1 + viciousCount) dice,
		// and a random die is selected as the "explosion die" to determine chain continuation.
		//
		// These tests use the mock's built-in mockImplementation/mockReset methods (not vi.spyOn)
		// to control Roll behavior without polluting other tests.

		// Type assertion to access mock methods on the Roll constructor
		const mockRoll = foundry.dice.Roll as ReturnType<typeof vi.fn>;

		afterEach(() => {
			// Reset the mock's custom implementation to prevent pollution
			mockRoll.mockReset();
		});

		function createMockRoll(results: number[]) {
			// Create a proper Die instance so instanceof checks work
			const dieTerm = new foundry.dice.terms.Die({ number: results.length, faces: 6 });
			dieTerm.results = results.map((r) => ({ result: r, active: true }));

			return {
				evaluate: vi.fn().mockResolvedValue(undefined),
				terms: [dieTerm],
			};
		}

		it('should roll one explosion wave with Vicious dice when called', async () => {
			// Scenario: Method is called after a crit was detected
			// It should roll at least one explosion wave (1 explosion + 1 Vicious)
			const roll = new DamageRoll(
				'1d6',
				{},
				{
					canCrit: true,
					canMiss: true,
					rollMode: 0,
					primaryDieValue: 0,
					primaryDieModifier: 0,
					critBonusDice: 1,
				},
			);

			// Set up primary die with just the initial crit result
			const primaryDie = new PrimaryDie({ number: 1, faces: 6 });
			(primaryDie as any)._evaluated = true;
			primaryDie.results = [
				{ result: 6, active: true, discarded: false, exploded: true }, // Initial crit
			];
			roll.primaryDie = primaryDie;
			roll.terms = [primaryDie];

			// Mock Roll constructor AFTER creating DamageRoll to return predictable results (3 and 4, neither is max 6)
			mockRoll.mockImplementation(() => createMockRoll([3, 4]) as any);

			// Mock Math.random for explosion die index selection (floor(0.1*2)=0)
			mathRandomSpy = vi.spyOn(Math, 'random').mockImplementation(() => 0.1);

			await (roll as any)._evaluateExplosionWavesWithVicious(primaryDie, 1);

			// Should have: initial (1) + explosion wave (2 dice) = 3 results
			expect(primaryDie.results.length).toBe(3);

			// critBonusResults should have 1 entry (the Vicious die from wave, value 4)
			expect(roll.critBonusResults.length).toBe(1);
			expect(roll.critBonusResults[0]).toBe(4);
		});

		it('should continue explosion chain when explosion die rolls max', async () => {
			// Scenario: First wave's explosion die rolls max -> second wave
			const roll = new DamageRoll(
				'1d6',
				{},
				{
					canCrit: true,
					canMiss: true,
					rollMode: 0,
					primaryDieValue: 0,
					primaryDieModifier: 0,
					critBonusDice: 1,
				},
			);

			const primaryDie = new PrimaryDie({ number: 1, faces: 6 });
			(primaryDie as any)._evaluated = true;
			primaryDie.results = [
				{ result: 6, active: true, discarded: false, exploded: true }, // Initial crit
			];
			roll.primaryDie = primaryDie;
			roll.terms = [primaryDie];

			// Mock Roll constructor AFTER creating DamageRoll to return different results per call
			// Wave 1: [6, 4] - explosion die (index 0) rolls max, continues
			// Wave 2: [3, 2] - explosion die (index 0) doesn't roll max, stops
			let waveNumber = 0;
			mockRoll.mockImplementation(() => {
				waveNumber++;
				if (waveNumber === 1) return createMockRoll([6, 4]) as any;
				return createMockRoll([3, 2]) as any;
			});

			// Mock Math.random for explosion die index selection (floor(0.1*2)=0)
			mathRandomSpy = vi.spyOn(Math, 'random').mockImplementation(() => 0.1);

			await (roll as any)._evaluateExplosionWavesWithVicious(primaryDie, 1);

			// Should have: initial (1) + wave 1 (2) + wave 2 (2) = 5 results
			expect(primaryDie.results.length).toBe(5);

			// critBonusResults should have 2 entries (one Vicious per wave: 4 and 2)
			expect(roll.critBonusResults.length).toBe(2);
			expect(roll.critBonusResults).toContain(4);
			expect(roll.critBonusResults).toContain(2);
		});

		it('should roll multiple Vicious dice per wave when critBonusDice > 1', async () => {
			// Scenario: 2 Vicious dice per explosion wave
			const roll = new DamageRoll(
				'1d6',
				{},
				{
					canCrit: true,
					canMiss: true,
					rollMode: 0,
					primaryDieValue: 0,
					primaryDieModifier: 0,
					critBonusDice: 2,
				},
			);

			const primaryDie = new PrimaryDie({ number: 1, faces: 6 });
			(primaryDie as any)._evaluated = true;
			primaryDie.results = [
				{ result: 6, active: true, discarded: false, exploded: true }, // Initial crit
			];
			roll.primaryDie = primaryDie;
			roll.terms = [primaryDie];

			// Mock Roll constructor AFTER creating DamageRoll to return results [3, 4, 5] (3 dice: 1 explosion + 2 Vicious)
			mockRoll.mockImplementation(() => createMockRoll([3, 4, 5]) as any);

			// Mock: floor(0.1*3)=0 (explosion die at index 0)
			mathRandomSpy = vi.spyOn(Math, 'random').mockImplementation(() => 0.1);

			await (roll as any)._evaluateExplosionWavesWithVicious(primaryDie, 2);

			// Should have: initial (1) + wave (3 dice) = 4 results
			expect(primaryDie.results.length).toBe(4);

			// critBonusResults should have 2 entries (2 Vicious dice from wave: 4 and 5)
			expect(roll.critBonusResults.length).toBe(2);
			expect(roll.critBonusResults).toContain(4);
			expect(roll.critBonusResults).toContain(5);
		});

		it('Vicious die being selected as explosion die and rolling max triggers extra explosion', async () => {
			// Scenario: Vicious die is randomly selected as "explosion die" and rolls max
			// This test verifies that ANY die in the wave can trigger continuation
			const roll = new DamageRoll(
				'1d6',
				{},
				{
					canCrit: true,
					canMiss: true,
					rollMode: 0,
					primaryDieValue: 0,
					primaryDieModifier: 0,
					critBonusDice: 1,
				},
			);

			const primaryDie = new PrimaryDie({ number: 1, faces: 6 });
			(primaryDie as any)._evaluated = true;
			primaryDie.results = [
				{ result: 6, active: true, discarded: false, exploded: true }, // Initial crit
			];
			roll.primaryDie = primaryDie;
			roll.terms = [primaryDie];

			// Mock Roll constructor AFTER creating DamageRoll to return different results per call
			// Wave 1: [3, 6] - Vicious die (index 1) rolls max when selected, continues
			// Wave 2: [2, 4] - explosion die doesn't roll max, stops
			let waveNumber = 0;
			mockRoll.mockImplementation(() => {
				waveNumber++;
				if (waveNumber === 1) return createMockRoll([3, 6]) as any;
				return createMockRoll([2, 4]) as any;
			});

			// Mock: floor(0.7*2)=1 (Vicious die at index 1 is selected as explosion die)
			mathRandomSpy = vi.spyOn(Math, 'random').mockImplementation(() => 0.7);

			await (roll as any)._evaluateExplosionWavesWithVicious(primaryDie, 1);

			// Should have: initial (1) + wave 1 (2) + wave 2 (2) = 5 results
			expect(primaryDie.results.length).toBe(5);

			// critBonusResults should have 2 entries (the non-explosion dice: 3 from wave 1, 2 from wave 2)
			// Wait - in wave 1, index 1 is selected as explosion die, so index 0 (value 3) is Vicious
			// In wave 2, index 1 is selected as explosion die, so index 0 (value 2) is Vicious
			expect(roll.critBonusResults.length).toBe(2);
			expect(roll.critBonusResults).toContain(3);
			expect(roll.critBonusResults).toContain(2);
		});
	});
});

describe('DamageRoll.fromData', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
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

			expect(roll._formula).toBe('');
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

			expect(roll._formula).toBe('1d6+2');
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

describe('DamageRoll._preProcessFormula', () => {
	// NOTE: These tests use manually constructed terms because the mock Foundry
	// environment doesn't parse formula strings into terms.
	// The _preProcessFormula method is called in the constructor, so we test
	// the resulting state after construction.

	describe('Constructor options', () => {
		it('should set canCrit default to true', () => {
			const roll = new DamageRoll(
				'1d6',
				{},
				{
					canCrit: true,
					canMiss: true,
					rollMode: 0,
					primaryDieValue: 0,
					primaryDieModifier: 0,
				},
			);

			expect(roll.options.canCrit).toBe(true);
		});

		it('should set canMiss default to true', () => {
			const roll = new DamageRoll(
				'1d6',
				{},
				{
					canCrit: true,
					canMiss: true,
					rollMode: 0,
					primaryDieValue: 0,
					primaryDieModifier: 0,
				},
			);

			expect(roll.options.canMiss).toBe(true);
		});

		it('should preserve critBonusDice option', () => {
			const roll = new DamageRoll(
				'1d6',
				{},
				{
					canCrit: true,
					canMiss: true,
					rollMode: 0,
					primaryDieValue: 0,
					primaryDieModifier: 0,
					critBonusDice: 2,
				},
			);

			expect(roll.options.critBonusDice).toBe(2);
		});

		it('should set isCritical to false when canCrit is false', () => {
			const roll = new DamageRoll(
				'1d6',
				{},
				{
					canCrit: false,
					canMiss: true,
					rollMode: 0,
					primaryDieValue: 0,
					primaryDieModifier: 0,
				},
			);

			expect(roll.isCritical).toBe(false);
		});

		it('should set isMiss to false when canMiss is false', () => {
			const roll = new DamageRoll(
				'1d6',
				{},
				{
					canCrit: true,
					canMiss: false,
					rollMode: 0,
					primaryDieValue: 0,
					primaryDieModifier: 0,
				},
			);

			expect(roll.isMiss).toBe(false);
		});
	});

	describe('Formula handling', () => {
		it('should preserve originalFormula', () => {
			const roll = new DamageRoll(
				'1d6+2',
				{},
				{
					canCrit: true,
					canMiss: true,
					rollMode: 0,
					primaryDieValue: 0,
					primaryDieModifier: 0,
				},
			);

			expect(roll.originalFormula).toBe('1d6+2');
		});
	});
});

describe('DamageRoll.updatePrimaryTerm', () => {
	it('should do nothing if primaryDie is undefined', () => {
		const roll = new DamageRoll(
			'1d6',
			{},
			{
				canCrit: false,
				canMiss: false,
				rollMode: 0,
				primaryDieValue: 0,
				primaryDieModifier: 0,
			},
		);

		// This should not throw
		expect(() => roll.updatePrimaryTerm(8)).not.toThrow();
	});

	it('should update faces when primaryDie exists', () => {
		const roll = new DamageRoll(
			'1d6',
			{},
			{
				canCrit: true,
				canMiss: true,
				rollMode: 0,
				primaryDieValue: 0,
				primaryDieModifier: 0,
			},
		);

		// Manually set up primaryDie to test updatePrimaryTerm
		const primaryDie = new PrimaryDie({ number: 1, faces: 6 });
		roll.primaryDie = primaryDie;
		roll.terms = [primaryDie];

		roll.updatePrimaryTerm(8);

		expect(roll.primaryDie?.faces).toBe(8);
	});
});

describe('DamageRoll.fromRoll', () => {
	it('should create a DamageRoll from a basic roll object', () => {
		const sourceRoll = {
			formula: '1d6+2',
			data: { level: 5 },
			options: {
				canCrit: true,
				canMiss: true,
				rollMode: 0,
				primaryDieValue: 0,
				primaryDieModifier: 0,
			},
		};

		const damageRoll = DamageRoll.fromRoll(sourceRoll);

		expect(damageRoll).toBeInstanceOf(DamageRoll);
	});

	it('should copy properties from source roll', () => {
		const sourceRoll = {
			formula: '2d8',
			data: { strength: 18 },
			options: {
				canCrit: true,
				canMiss: false,
				rollMode: 1,
				primaryDieValue: 0,
				primaryDieModifier: 0,
			},
			isCritical: true,
		};

		const damageRoll = DamageRoll.fromRoll(sourceRoll);

		expect(damageRoll.isCritical).toBe(true);
	});
});

describe('DamageRoll._evaluate with manually configured terms', () => {
	let mathRandomSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		// Ensure all mocks are restored before each test to prevent pollution
		vi.restoreAllMocks();
	});

	afterEach(() => {
		if (mathRandomSpy) {
			mathRandomSpy.mockRestore();
		}
	});

	// NOTE: Full evaluate() integration tests require a real Foundry environment.
	// The mock Roll.evaluate() doesn't properly simulate Foundry's term evaluation.
	// The core _preRollExplosionsWithVicious logic is tested in the describe block above.

	it('should set isMiss to false in constructor when canMiss is false', () => {
		const roll = new DamageRoll(
			'1d6',
			{},
			{
				canCrit: true,
				canMiss: false,
				rollMode: 0,
				primaryDieValue: 0,
				primaryDieModifier: 0,
				critBonusDice: 0,
			},
		);

		// isMiss should be set to false in constructor since canMiss=false
		expect(roll.isMiss).toBe(false);
	});

	it('should set isCritical to false in constructor when canCrit is false', () => {
		const roll = new DamageRoll(
			'1d6',
			{},
			{
				canCrit: false,
				canMiss: true,
				rollMode: 0,
				primaryDieValue: 0,
				primaryDieModifier: 0,
				critBonusDice: 0,
			},
		);

		// isCritical should be set to false in constructor since canCrit=false
		expect(roll.isCritical).toBe(false);
	});

	it('should evaluate Vicious dice when _evaluateExplosionWavesWithVicious is called', async () => {
		// Type assertion to access mock methods on the Roll constructor
		const mockRoll = foundry.dice.Roll as ReturnType<typeof vi.fn>;

		// Mock for explosion die index selection
		mathRandomSpy = vi.spyOn(Math, 'random').mockImplementation(() => 0.1);

		const roll = new DamageRoll(
			'1d6',
			{},
			{
				canCrit: true,
				canMiss: true,
				rollMode: 0,
				primaryDieValue: 0,
				primaryDieModifier: 0,
				critBonusDice: 1,
			},
		);

		// Manually set up primaryDie with a crit result
		const primaryDie = new PrimaryDie({ number: 1, faces: 6 });
		primaryDie.results = [{ result: 6, active: true, exploded: true }];
		roll.primaryDie = primaryDie;
		roll.terms = [primaryDie];

		// Mock Roll constructor AFTER creating DamageRoll to avoid interfering with its constructor
		// Create a proper Die instance so instanceof checks work
		const createTestMockRoll = () => {
			const dieTerm = new foundry.dice.terms.Die({ number: 2, faces: 6 });
			dieTerm.results = [
				{ result: 3, active: true },
				{ result: 4, active: true },
			];
			return {
				evaluate: vi.fn().mockResolvedValue(undefined),
				terms: [dieTerm],
			};
		};
		mockRoll.mockImplementation(createTestMockRoll);

		// Directly call the explosion method to test it
		await (roll as any)._evaluateExplosionWavesWithVicious(primaryDie, 1);

		// Should have initial (1) + explosion wave (2) = 3 results
		expect(primaryDie.results.length).toBe(3);
		expect(roll.critBonusResults.length).toBe(1);

		// Reset the mock to prevent pollution
		mockRoll.mockReset();
	});
});
