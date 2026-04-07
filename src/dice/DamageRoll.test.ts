import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EffectNode } from '#types/effectTree.js';
import { ItemActivationManager, testDependencies } from '../managers/ItemActivationManager.js';
import { hasWeaponProficiency } from '../view/sheets/components/attackUtils.js';
import { DamageRoll } from './DamageRoll.js';
import { khn as nimbleKhn, kln as nimbleKln } from './nimbleDieModifiers.js';

type DieResult = {
	result: number;
	active: boolean;
	discarded?: boolean;
	exploded?: boolean;
};

/**
 * Install a no-op `_evaluate` on the base Roll prototype so that
 * `super._evaluate(options)` inside DamageRoll._evaluate resolves without
 * error. Must be called in a `beforeEach` so it is restored between tests.
 *
 * The project's Foundry mock (tests/mocks/foundry.ts) provides a mock Roll
 * class but does NOT implement `_evaluate`, nor does its mock Die populate
 * results from a keep-highest/keep-lowest or explode modifier. Therefore
 * tests below manually stage `primaryDie.results` to simulate what the real
 * Foundry RNG + modifier resolution would produce, then rely on this stub
 * so DamageRoll's own `_evaluate` can run its post-super logic (isCritical
 * / isMiss / primaryDieAsDamage / vicious explosion handling).
 */
function stubBaseRollEvaluate() {
	const BaseRoll = Object.getPrototypeOf(DamageRoll.prototype);
	Object.defineProperty(BaseRoll, '_evaluate', {
		value: async function () {
			const terms = (this as any).terms ?? [];
			for (const term of terms) {
				if (!term || !Array.isArray(term.modifiers) || !Array.isArray(term.results)) continue;
				for (const m of term.modifiers as string[]) {
					if (/^khn\d*$/.test(m)) nimbleKhn.call(term, m);
					else if (/^kln\d*$/.test(m)) nimbleKln.call(term, m);
				}
			}
			return this;
		},
		configurable: true,
		writable: true,
	});
}

/**
 * Stage evaluated state on a DamageRoll so that calling `_evaluate` exercises
 * the post-evaluation logic (isCritical / isMiss / total adjustments).
 */
function stagePrimaryDieResults(roll: DamageRoll, results: DieResult[], total: number) {
	if (!roll.primaryDie) throw new Error('roll has no primaryDie — cannot stage results');
	roll.primaryDie.results = results as any;
	(roll.primaryDie as any)._evaluated = true;
	(roll as any)._evaluated = true;
	(roll as any)._total = total;
}

function ensureGameUserTargets() {
	const g = globalThis as any;
	if (!g.game) g.game = {};
	if (!g.game.user) g.game.user = { targets: [] };
	if (!g.game.user.targets) g.game.user.targets = [];
}

function makeMockDamageRollClass() {
	const calls: Array<{ formula: string; data: unknown; options: any }> = [];
	const Mock = vi.fn(function MockDamageRoll(
		this: any,
		formula: string,
		data: unknown,
		options: any,
	) {
		calls.push({ formula, data, options });
		return {
			evaluate: vi.fn().mockResolvedValue(undefined),
			toJSON: vi.fn().mockReturnValue({ total: 0 }),
			options,
			isCritical: options?.canCrit ? undefined : false,
			isMiss: options?.canMiss ? undefined : false,
		};
	}) as unknown as typeof DamageRoll & { calls: typeof calls };
	(Mock as any).calls = calls;
	return Mock;
}

function makeAoEItem(actor: any, overrides: Record<string, unknown> = {}) {
	return {
		type: 'weapon',
		name: 'Fireball Wand',
		actor,
		system: {
			weaponType: '',
			properties: { selected: [] },
			activation: {
				effects: [],
				template: { shape: 'circle', length: 3, radius: 2, width: 1 },
				targets: { count: 1, attackType: '' },
			},
			...overrides,
		},
	};
}

describe('DamageRoll preprocessing', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('Primary die extraction (attacks with canCrit or canMiss)', () => {
		it('should extract primary die from single die formula', () => {
			const roll = new DamageRoll(
				'1d6',
				{},
				{ canCrit: true, canMiss: true, rollMode: 0, primaryDieValue: 0, primaryDieModifier: 0 },
			);

			expect(roll.formula).toBe('1d6x');
			expect(roll.primaryDie).toBeDefined();
		});

		it('should extract primary die from multi-die formula', () => {
			const roll = new DamageRoll(
				'2d6',
				{},
				{ canCrit: true, canMiss: true, rollMode: 0, primaryDieValue: 0, primaryDieModifier: 0 },
			);

			// 2d6 becomes: 1d6x (primary) + 1d6 (damage)
			expect(roll.formula).toBe('1d6x + 1d6');
			expect(roll.primaryDie).toBeDefined();
		});

		it('should apply advantage to primary die only', () => {
			const roll = new DamageRoll(
				'2d6',
				{},
				{ canCrit: true, canMiss: true, rollMode: 1, primaryDieValue: 0, primaryDieModifier: 0 },
			);

			// Primary die gets advantage (2d6kh), rest stays as damage
			// 2d6 with advantage → 2d6khx (primary) + 1d6 (damage)
			expect(roll.formula).toBe('2d6khnx + 1d6');
			expect(roll.primaryDie).toBeDefined();
			expect(roll.primaryDie?.number).toBe(2);
		});

		it('should apply disadvantage to primary die only', () => {
			const roll = new DamageRoll(
				'2d6',
				{},
				{ canCrit: true, canMiss: true, rollMode: -1, primaryDieValue: 0, primaryDieModifier: 0 },
			);

			// Primary die gets disadvantage (2d6kl), rest stays as damage
			expect(roll.formula).toBe('2d6klnx + 1d6');
			expect(roll.primaryDie).toBeDefined();
			expect(roll.primaryDie?.number).toBe(2);
		});

		it('should apply multiple levels of advantage to primary die', () => {
			const roll = new DamageRoll(
				'1d8',
				{},
				{ canCrit: true, canMiss: true, rollMode: 2, primaryDieValue: 0, primaryDieModifier: 0 },
			);

			// 1d8 with advantage 2 → 3d8khx (roll 3, keep 1)
			expect(roll.formula).toBe('3d8khnx');
			expect(roll.primaryDie?.number).toBe(3);
		});

		it('should add explosion modifier when canCrit is true', () => {
			const roll = new DamageRoll(
				'1d6',
				{},
				{ canCrit: true, canMiss: false, rollMode: 0, primaryDieValue: 0, primaryDieModifier: 0 },
			);

			expect(roll.formula).toBe('1d6x');
		});

		it('should not add explosion modifier when canCrit is false', () => {
			const roll = new DamageRoll(
				'1d6',
				{},
				{ canCrit: false, canMiss: true, rollMode: 0, primaryDieValue: 0, primaryDieModifier: 0 },
			);

			expect(roll.formula).toBe('1d6');
			expect(roll.primaryDie).toBeDefined();
		});
	});

	describe('AoE advantage/disadvantage (no primary die)', () => {
		it('should apply advantage to entire first die term for AoE', () => {
			const roll = new DamageRoll(
				'2d8',
				{},
				{ canCrit: false, canMiss: false, rollMode: 1, primaryDieValue: 0, primaryDieModifier: 0 },
			);

			// 2d8 with advantage → 3d8kh2 (roll 3, keep highest 2)
			expect(roll.formula).toBe('3d8khn2');
			expect(roll.primaryDie).toBeUndefined();
		});

		it('should apply disadvantage to entire first die term for AoE', () => {
			const roll = new DamageRoll(
				'2d8',
				{},
				{ canCrit: false, canMiss: false, rollMode: -1, primaryDieValue: 0, primaryDieModifier: 0 },
			);

			// 2d8 with disadvantage → 3d8kl2 (roll 3, keep lowest 2)
			expect(roll.formula).toBe('3d8kln2');
			expect(roll.primaryDie).toBeUndefined();
		});

		it('should apply advantage to single die AoE', () => {
			const roll = new DamageRoll(
				'1d8',
				{},
				{ canCrit: false, canMiss: false, rollMode: 1, primaryDieValue: 0, primaryDieModifier: 0 },
			);

			// 1d8 with advantage → 2d8kh (roll 2, keep 1)
			expect(roll.formula).toBe('2d8khn');
			expect(roll.primaryDie).toBeUndefined();
		});

		it('should apply multiple levels of advantage to AoE', () => {
			const roll = new DamageRoll(
				'2d6',
				{},
				{ canCrit: false, canMiss: false, rollMode: 2, primaryDieValue: 0, primaryDieModifier: 0 },
			);

			// 2d6 with advantage 2 → 4d6kh2 (roll 4, keep highest 2)
			expect(roll.formula).toBe('4d6khn2');
		});

		it('should apply multiple levels of disadvantage to AoE', () => {
			const roll = new DamageRoll(
				'3d6',
				{},
				{ canCrit: false, canMiss: false, rollMode: -2, primaryDieValue: 0, primaryDieModifier: 0 },
			);

			// 3d6 with disadvantage 2 → 5d6kl3 (roll 5, keep lowest 3)
			expect(roll.formula).toBe('5d6kln3');
		});

		it('should preserve formula modifiers for AoE with advantage', () => {
			const roll = new DamageRoll(
				'2d8 + 4',
				{},
				{ canCrit: false, canMiss: false, rollMode: 1, primaryDieValue: 0, primaryDieModifier: 0 },
			);

			// 2d8 + 4 with advantage → 3d8kh2 + 4
			expect(roll.formula).toBe('3d8khn2 + 4');
		});
	});

	describe('No processing needed', () => {
		it('should not modify formula when canCrit=false, canMiss=false, rollMode=0', () => {
			const roll = new DamageRoll(
				'2d8',
				{},
				{ canCrit: false, canMiss: false, rollMode: 0, primaryDieValue: 0, primaryDieModifier: 0 },
			);

			expect(roll.formula).toBe('2d8');
			expect(roll.primaryDie).toBeUndefined();
		});

		it('should not modify formula with modifiers when no processing needed', () => {
			const roll = new DamageRoll(
				'2d8 + 5',
				{},
				{ canCrit: false, canMiss: false, rollMode: 0, primaryDieValue: 0, primaryDieModifier: 0 },
			);

			expect(roll.formula).toBe('2d8 + 5');
		});
	});

	describe('Edge cases', () => {
		it('should handle formula with only numeric terms', () => {
			const roll = new DamageRoll(
				'5',
				{},
				{ canCrit: false, canMiss: false, rollMode: 1, primaryDieValue: 0, primaryDieModifier: 0 },
			);

			// No die term to modify
			expect(roll.formula).toBe('5');
		});

		it('should set isCritical to false when canCrit is false', () => {
			const roll = new DamageRoll(
				'2d8',
				{},
				{ canCrit: false, canMiss: false, rollMode: 0, primaryDieValue: 0, primaryDieModifier: 0 },
			);

			expect(roll.isCritical).toBe(false);
		});

		it('should set isMiss to false when canMiss is false', () => {
			const roll = new DamageRoll(
				'2d8',
				{},
				{ canCrit: false, canMiss: false, rollMode: 0, primaryDieValue: 0, primaryDieModifier: 0 },
			);

			expect(roll.isMiss).toBe(false);
		});
	});
});

describe('DamageRoll vicious weapon preprocessing', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should not add explosion modifier when isVicious is true', () => {
		const roll = new DamageRoll(
			'1d6',
			{},
			{
				canCrit: true,
				canMiss: true,
				rollMode: 0,
				primaryDieValue: 0,
				primaryDieModifier: 0,
				isVicious: true,
			},
		);

		// Vicious weapons should NOT have 'x' modifier - they handle explosion manually
		expect(roll.formula).toBe('1d6');
		expect(roll.primaryDie).toBeDefined();
	});

	it('should add explosion modifier when isVicious is false (default)', () => {
		const roll = new DamageRoll(
			'1d6',
			{},
			{
				canCrit: true,
				canMiss: true,
				rollMode: 0,
				primaryDieValue: 0,
				primaryDieModifier: 0,
				isVicious: false,
			},
		);

		// Non-vicious weapons should have 'x' modifier for automatic explosion
		expect(roll.formula).toBe('1d6x');
		expect(roll.primaryDie).toBeDefined();
	});

	it('should apply advantage to vicious primary die without explosion modifier', () => {
		const roll = new DamageRoll(
			'2d6',
			{},
			{
				canCrit: true,
				canMiss: true,
				rollMode: 1,
				primaryDieValue: 0,
				primaryDieModifier: 0,
				isVicious: true,
			},
		);

		// Should have advantage modifier but no explosion modifier
		expect(roll.formula).toBe('2d6khn + 1d6');
		expect(roll.primaryDie).toBeDefined();
		expect(roll.primaryDie?.number).toBe(2);
	});

	it('should pass isVicious flag to primary die options', () => {
		const roll = new DamageRoll(
			'1d6',
			{},
			{
				canCrit: true,
				canMiss: true,
				rollMode: 0,
				primaryDieValue: 0,
				primaryDieModifier: 0,
				isVicious: true,
			},
		);

		expect(roll.primaryDie).toBeDefined();
		expect(roll.primaryDie?.options.isVicious).toBe(true);
	});

	it('should not add isVicious to primary die when isVicious is false', () => {
		const roll = new DamageRoll(
			'1d6',
			{},
			{
				canCrit: true,
				canMiss: true,
				rollMode: 0,
				primaryDieValue: 0,
				primaryDieModifier: 0,
				isVicious: false,
			},
		);

		expect(roll.primaryDie).toBeDefined();
		// isVicious should be undefined or false (not explicitly true)
		expect(roll.primaryDie?.options.isVicious).toBeFalsy();
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
				netRollMode: 0,
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
				netRollMode: 1,
				primaryDieAsDamage: true,
			});
		});
	});
});

describe('DamageRoll evaluation — primary die outcome', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		stubBaseRollEvaluate();
	});

	it('regression_primary_is_leftmost: 2d6 no adv, primary = first die', () => {
		const roll = new DamageRoll(
			'2d6',
			{},
			{ canCrit: true, canMiss: true, rollMode: 0, primaryDieValue: 0, primaryDieModifier: 0 },
		);
		// Formula should split 2d6 into primary + 1d6 damage
		expect(roll.formula).toBe('1d6x + 1d6');
		expect(roll.primaryDie).toBeDefined();
		expect(roll.primaryDie?.number).toBe(1);
	});

	it('regression_primary_miss: 1d8, primary rolls 1 → isMiss', async () => {
		const roll = new DamageRoll(
			'1d8',
			{},
			{ canCrit: true, canMiss: true, rollMode: 0, primaryDieValue: 0, primaryDieModifier: 0 },
		);
		stagePrimaryDieResults(roll, [{ result: 1, active: true }], 1);
		await (roll as any)._evaluate();
		expect(roll.isMiss).toBe(true);
		expect(roll.isCritical).toBe(false);
	});

	it('regression_primary_crit_explodes: 1d8, rolls [8, 5] → crit, total 13', async () => {
		const roll = new DamageRoll(
			'1d8',
			{},
			{ canCrit: true, canMiss: true, rollMode: 0, primaryDieValue: 0, primaryDieModifier: 0 },
		);
		stagePrimaryDieResults(
			roll,
			[
				{ result: 8, active: true, exploded: true },
				{ result: 5, active: true },
			],
			13,
		);
		await (roll as any)._evaluate();
		expect(roll.isCritical).toBe(true);
		expect(roll.isMiss).toBe(false);
		expect(roll.total).toBe(13);
	});

	it('regression_crit_explodes_chain: 1d6 → [6, 6, 4], chain of crits, total 16', async () => {
		const roll = new DamageRoll(
			'1d6',
			{},
			{ canCrit: true, canMiss: true, rollMode: 0, primaryDieValue: 0, primaryDieModifier: 0 },
		);
		stagePrimaryDieResults(
			roll,
			[
				{ result: 6, active: true, exploded: true },
				{ result: 6, active: true, exploded: true },
				{ result: 4, active: true },
			],
			16,
		);
		await (roll as any)._evaluate();
		expect(roll.isCritical).toBe(true);
		expect(roll.total).toBe(16);
	});

	it('regression_bonus_dice_never_crit: 1d8 + 2d6 sneak, primary [1] → MISS despite high bonus dice', async () => {
		// The bonus dice 2d6 are a separate term in the formula, they cannot
		// influence isMiss / isCritical because only the primaryDie drives them.
		const roll = new DamageRoll(
			'1d8 + 2d6',
			{},
			{ canCrit: true, canMiss: true, rollMode: 0, primaryDieValue: 0, primaryDieModifier: 0 },
		);
		// primary gets 1; the sneak attack 2d6 would independently roll big — irrelevant
		stagePrimaryDieResults(roll, [{ result: 1, active: true }], 13);
		await (roll as any)._evaluate();
		expect(roll.isMiss).toBe(true);
		expect(roll.isCritical).toBe(false);
	});

	it('regression_vicious_only_on_crit: vicious primary rolls 5 (not max) → no extra explosion', async () => {
		const roll = new DamageRoll(
			'1d8',
			{},
			{
				canCrit: true,
				canMiss: true,
				rollMode: 0,
				primaryDieValue: 0,
				primaryDieModifier: 0,
				isVicious: true,
			},
		);
		// Vicious weapons should NOT have 'x' modifier; it is handled manually
		expect(roll.formula).toBe('1d8');
		stagePrimaryDieResults(roll, [{ result: 5, active: true }], 5);
		await (roll as any)._evaluate();
		expect(roll.isCritical).toBe(false);
		// Only the base result remains — no vicious explosion dice added
		expect(roll.primaryDie?.results.length).toBe(1);
	});

	it('regression_adv_resolved_before_primary: 2d6 adv rolling [1,2,6] → primary=2, hit (headline case)', async () => {
		const roll = new DamageRoll(
			'2d6',
			{},
			{ canCrit: true, canMiss: true, rollMode: 1, primaryDieValue: 0, primaryDieModifier: 0 },
		);
		// With adv, primary term becomes 2d6khx, damage = 1d6
		expect(roll.formula).toBe('2d6khnx + 1d6');

		// Simulate Foundry's resolution: 3 dice rolled (orig 2 + 1 extra due to adv),
		// BUT DamageRoll applies adv to primary with keepCount=1, so primary is 2d6kh.
		// The leftmost 1 is discarded, the 2 is kept as the active primary value.
		// (If leftmost-tie-break is wrong, the dropped die might instead be the 1
		//  via Foundry kh which already picks highest — in this asymmetric case
		//  there is no tie, so both interpretations agree: keep 6, miss? NO —
		//  keep highest means keep the 6. So the primary becomes 6, a crit. This
		//  test therefore locks in CURRENT behaviour: Foundry kh keeps 6.)
		stagePrimaryDieResults(
			roll,
			[
				{ result: 1, active: false, discarded: true },
				{ result: 6, active: true, exploded: true },
			],
			10,
		);
		await (roll as any)._evaluate();
		// Under current code, the kept die is the 6 (highest) → crit, not miss.
		// We are NOT testing leftmost-tie-break here (that's bug5), just that
		// the dropped 1 does not cause a miss.
		expect(roll.isMiss).toBe(false);
	});

	it('regression_minion_cannot_crit: minion damage roll with canCrit=false', async () => {
		// ItemActivationManager sets canCrit=false for minions; we simulate
		// that directly here to lock in the DamageRoll side of the contract.
		const roll = new DamageRoll(
			'1d8',
			{},
			{ canCrit: false, canMiss: true, rollMode: 0, primaryDieValue: 0, primaryDieModifier: 0 },
		);
		// Without canCrit, no explosion modifier, and isCritical is locked to false
		expect(roll.formula).toBe('1d8');
		expect(roll.isCritical).toBe(false);

		stagePrimaryDieResults(roll, [{ result: 8, active: true }], 8);
		await (roll as any)._evaluate();
		// Even rolling max, isCritical must stay false
		expect(roll.isCritical).toBe(false);
	});

	it('bug5_ties_drop_leftmost (adv, [1,2,6]): leftmost-lowest dropped, primary becomes 2, hit', async () => {
		// Handler-level scenario: 3 dice, keep highest 2 with Nimble's
		// leftmost-on-tie rule. With rolled [1, 2, 6] the lone lowest 1
		// (index 0) must be discarded. The 2 at index 1 and the 6 at index 2
		// are both kept; the lowest kept (the 2) drives isMiss → false.
		const roll = new DamageRoll(
			'2d6',
			{},
			{ canCrit: true, canMiss: true, rollMode: 1, primaryDieValue: 0, primaryDieModifier: 0 },
		);
		// Override the primary die's modifiers to keep-2 semantics so we can
		// stage a 3-die scenario and verify the handler's tie-break behaviour.
		if (roll.primaryDie) {
			roll.primaryDie.modifiers = ['khn2'];
		}
		// Stage the raw rolled values; let the registered Nimble modifier
		// handler decide which to discard during evaluation.
		stagePrimaryDieResults(
			roll,
			[
				{ result: 1, active: true },
				{ result: 2, active: true },
				{ result: 6, active: true },
			],
			8,
		);
		await (roll as any)._evaluate();
		const results = roll.primaryDie?.results ?? [];
		expect(results[0].discarded).toBe(true);
		expect(results[0].active).toBe(false);
		expect(results[1].discarded).toBeFalsy();
		expect(results[1].active).toBe(true);
		expect(results[2].discarded).toBeFalsy();
		expect(roll.isMiss).toBe(false);
	});

	it('bug5_ties_drop_leftmost (adv, [3,3,5]): leftmost tied-lowest dropped, primary kept = 3 at index 1', async () => {
		const roll = new DamageRoll(
			'2d6',
			{},
			{ canCrit: true, canMiss: true, rollMode: 1, primaryDieValue: 0, primaryDieModifier: 0 },
		);
		if (roll.primaryDie) {
			roll.primaryDie.modifiers = ['khn2'];
		}
		stagePrimaryDieResults(
			roll,
			[
				{ result: 3, active: true },
				{ result: 3, active: true },
				{ result: 5, active: true },
			],
			8,
		);
		await (roll as any)._evaluate();
		const results = roll.primaryDie?.results ?? [];
		// Leftmost tied 3 must be the dropped one
		expect(results[0].discarded).toBe(true);
		expect(results[0].active).toBe(false);
		expect(results[1].discarded).toBeFalsy();
		expect(results[1].active).toBe(true);
		expect(results[2].discarded).toBeFalsy();
		expect(roll.isMiss).toBe(false);
		expect(roll.isCritical).toBe(false);
	});

	it('bug5_ties_drop_leftmost (dis, [5,5,2]): leftmost tied-highest dropped, primary kept = 5 at index 1, not crit', async () => {
		const roll = new DamageRoll(
			'2d6',
			{},
			{ canCrit: true, canMiss: true, rollMode: -1, primaryDieValue: 0, primaryDieModifier: 0 },
		);
		if (roll.primaryDie) {
			roll.primaryDie.modifiers = ['kln2'];
		}
		stagePrimaryDieResults(
			roll,
			[
				{ result: 5, active: true },
				{ result: 5, active: true },
				{ result: 2, active: true },
			],
			7,
		);
		await (roll as any)._evaluate();
		const results = roll.primaryDie?.results ?? [];
		// Disadvantage = drop highest. Leftmost tied 5 must be dropped.
		expect(results[0].discarded).toBe(true);
		expect(results[0].active).toBe(false);
		expect(results[1].discarded).toBeFalsy();
		expect(results[1].active).toBe(true);
		expect(results[2].discarded).toBeFalsy();
		// 5 is not max on a d6, so not a crit
		expect(roll.isCritical).toBe(false);
	});

	it('bug5_integration_full_path_advantage: normally-built DamageRoll routes [1,2] through registered khn handler', async () => {
		// End-to-end exercise of the bug5 fix:
		//   1. DamageRoll is constructed exactly as ItemActivationManager would build it
		//      (matching `regression_adv_resolved_before_primary` above) — no test-side
		//      modifier injection.
		//   2. The constructor's `_extractPrimaryDie` + `_applyRollMode` path
		//      emits the `khn` modifier on the primary term (2 dice, keep 1) plus `x` for crits.
		//   3. We stage the underlying rolled values [1, 2] on the primary die's results
		//      (the mock cannot drive RNG end-to-end — see file header note).
		//   4. `_evaluate` invokes the registered Nimble `khn` handler, which must drop
		//      the leftmost low die and keep the 2 as the active primary value.
		const roll = new DamageRoll(
			'2d6',
			{},
			{ canCrit: true, canMiss: true, rollMode: 1, primaryDieValue: 0, primaryDieModifier: 0 },
		);
		// Confirm the constructor wired the real Nimble modifier — no manual override.
		expect(roll.formula).toBe('2d6khnx + 1d6');
		expect(roll.primaryDie?.modifiers).toContain('khn');

		stagePrimaryDieResults(
			roll,
			[
				{ result: 1, active: true },
				{ result: 2, active: true },
			],
			3,
		);
		await (roll as any)._evaluate();

		const results = roll.primaryDie?.results ?? [];
		// Leftmost (the 1) was dropped by the registered khn handler.
		expect(results[0].discarded).toBe(true);
		expect(results[0].active).toBe(false);
		// The 2 is the kept, contributing primary value.
		expect(results[1].discarded).toBeFalsy();
		expect(results[1].active).toBe(true);
		expect(results[1].result).toBe(2);
		// Primary is now the 2, not the dropped 1 → not a miss.
		expect(roll.isMiss).toBe(false);
		expect(roll.isCritical).toBe(false);
	});
});

describe('DamageRoll integration — ItemActivationManager AoE and proficiency', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		stubBaseRollEvaluate();
	});

	it('bug6_adv_dis_cancel: +1 adv and -1 dis from two sources should net to 0', () => {
		// The current code passes `rollMode` as a single signed integer. There is
		// no aggregation layer: the caller must sum sources manually. This test
		// asserts an API that does NOT yet exist — that a DamageRoll constructed
		// with TWO rollMode sources (e.g. via an array or two calls) yields a
		// NET rollMode of 0. Expected to FAIL because the Options shape only
		// accepts a single scalar `rollMode`.
		//
		// Concrete assertion: we try passing rollMode as an array; current code
		// will either coerce it to NaN or misinterpret it. A correct implementation
		// would expose something like `rollModeSources: [+1, -1]` and compute net.
		const roll = new DamageRoll(
			'2d6',
			{},
			// Intentionally abuse the API to expose the gap
			{
				canCrit: true,
				canMiss: true,
				rollMode: (+1 + -1) as number, // caller had to aggregate manually
				primaryDieValue: 0,
				primaryDieModifier: 0,
				// Simulate what a fixed API would look like:
				rollModeSources: [+1, -1],
			} as any,
		);
		// Under a fixed engine: net rollMode 0 → no adv/dis, formula '1d6x + 1d6'.
		// Under current engine: caller-aggregated 0 happens to produce the right
		//   formula, but `rollModeSources` is silently ignored → no regression
		//   signal. So we assert the engine read rollModeSources itself:
		expect((roll.options as any).rollModeSources).toEqual([+1, -1]);
		// And we assert that the engine stored a NET rollMode derived from sources
		// (this will fail: current engine does not compute this).
		expect((roll.options as any).netRollMode).toBe(0);
	});

	it('bug6_adv_stacks: +1 and +1 from two sources should net +2', () => {
		const roll = new DamageRoll('1d8', {}, {
			canCrit: true,
			canMiss: true,
			rollMode: 1, // caller-aggregated single source only
			primaryDieValue: 0,
			primaryDieModifier: 0,
			rollModeSources: [+1, +1],
		} as any);
		// Expected under fixed engine: net +2, primary becomes 3d8khx
		expect((roll.options as any).netRollMode).toBe(2);
		expect(roll.formula).toBe('3d8khnx');
	});

	it('bug7_aoe_flags_auto_set: AoE template forces canCrit=false and canMiss=false', async () => {
		const MockDamageRoll = makeMockDamageRollClass();
		const originalDR = testDependencies.DamageRoll;
		const originalRecon = testDependencies.reconstructEffectsTree;
		(testDependencies as any).DamageRoll = MockDamageRoll;
		(testDependencies as any).reconstructEffectsTree = (effects: EffectNode[]) => effects;
		ensureGameUserTargets();

		try {
			const actor = {
				uuid: 'a1',
				token: null,
				type: 'character',
				getRollData: () => ({}),
				system: { proficiencies: { weapons: [] } },
			};
			const item = makeAoEItem(actor);
			const manager = new ItemActivationManager(item as any, { fastForward: true });
			manager.activationData = {
				effects: [
					{
						id: 'd1',
						type: 'damage',
						damageType: 'fire',
						formula: '1d6',
						canCrit: true,
						canMiss: true,
						parentContext: null,
						parentNode: null,
					} as any,
				],
			};

			await manager.getData();

			expect((MockDamageRoll as any).calls.length).toBe(1);
			const opts = (MockDamageRoll as any).calls[0].options;
			expect(opts.canCrit).toBe(false);
			expect(opts.canMiss).toBe(false);
		} finally {
			(testDependencies as any).DamageRoll = originalDR;
			(testDependencies as any).reconstructEffectsTree = originalRecon;
		}
	});

	it('bug7_aoe_flags_auto_set: targets.count > 1 also forces canCrit=false and canMiss=false', async () => {
		const MockDamageRoll = makeMockDamageRollClass();
		const originalDR = testDependencies.DamageRoll;
		const originalRecon = testDependencies.reconstructEffectsTree;
		(testDependencies as any).DamageRoll = MockDamageRoll;
		(testDependencies as any).reconstructEffectsTree = (effects: EffectNode[]) => effects;
		ensureGameUserTargets();

		try {
			const actor = {
				uuid: 'a1',
				token: null,
				type: 'character',
				getRollData: () => ({}),
				system: { proficiencies: { weapons: [] } },
			};
			const item = {
				type: 'weapon',
				name: 'Multi-target Strike',
				actor,
				system: {
					weaponType: '',
					properties: { selected: [] },
					activation: {
						effects: [],
						template: { shape: '', length: 1, radius: 1, width: 1 },
						targets: { count: 3, attackType: 'reach' },
					},
				},
			};
			const manager = new ItemActivationManager(item as any, { fastForward: true });
			manager.activationData = {
				effects: [
					{
						id: 'd1',
						type: 'damage',
						damageType: 'slashing',
						formula: '1d8',
						canCrit: true,
						canMiss: true,
						parentContext: null,
						parentNode: null,
					} as any,
				],
			};

			await manager.getData();

			const opts = (MockDamageRoll as any).calls[0].options;
			expect(opts.canCrit).toBe(false);
			expect(opts.canMiss).toBe(false);
		} finally {
			(testDependencies as any).DamageRoll = originalDR;
			(testDependencies as any).reconstructEffectsTree = originalRecon;
		}
	});

	it('bug8b_no_prof_crit_suppressed: hasWeaponProficiency baseline cases', () => {
		// Permissive default: empty weaponType allows everyone
		expect(hasWeaponProficiency({} as any, { system: { weaponType: '' } })).toBe(true);
		expect(hasWeaponProficiency({} as any, { system: {} })).toBe(true);
		expect(hasWeaponProficiency({} as any, undefined)).toBe(true);

		// Explicit type, actor proficient
		expect(
			hasWeaponProficiency({ system: { proficiencies: { weapons: ['Longsword'] } } } as any, {
				system: { weaponType: 'Longsword' },
			}),
		).toBe(true);

		// Explicit type, actor NOT proficient
		expect(
			hasWeaponProficiency({ system: { proficiencies: { weapons: ['Longsword'] } } } as any, {
				system: { weaponType: 'Greatsword' },
			}),
		).toBe(false);

		// Set-shaped proficiencies still work
		expect(
			hasWeaponProficiency(
				{ system: { proficiencies: { weapons: new Set(['Longsword']) } } } as any,
				{ system: { weaponType: 'Longsword' } },
			),
		).toBe(true);
	});

	it('bug8b_no_prof_crit_suppressed: lacking proficiency forces canCrit=false through ItemActivationManager', async () => {
		const MockDamageRoll = makeMockDamageRollClass();
		const originalDR = testDependencies.DamageRoll;
		const originalRecon = testDependencies.reconstructEffectsTree;
		(testDependencies as any).DamageRoll = MockDamageRoll;
		(testDependencies as any).reconstructEffectsTree = (effects: EffectNode[]) => effects;
		ensureGameUserTargets();

		try {
			const actor = {
				uuid: 'a1',
				token: null,
				type: 'character',
				getRollData: () => ({}),
				system: { proficiencies: { weapons: ['Longsword'] } },
			};
			const item = {
				type: 'weapon',
				name: 'Greatsword',
				actor,
				system: {
					weaponType: 'Greatsword',
					properties: { selected: [] },
					activation: {
						effects: [],
						template: { shape: '', length: 1, radius: 1, width: 1 },
						targets: { count: 1, attackType: 'reach' },
					},
				},
			};
			const manager = new ItemActivationManager(item as any, { fastForward: true });
			manager.activationData = {
				effects: [
					{
						id: 'd1',
						type: 'damage',
						damageType: 'slashing',
						formula: '1d12',
						canCrit: true,
						canMiss: true,
						parentContext: null,
						parentNode: null,
					} as any,
				],
			};

			await manager.getData();

			const opts = (MockDamageRoll as any).calls[0].options;
			expect(opts.canCrit).toBe(false);
			// Non-AoE: misses still allowed
			expect(opts.canMiss).toBe(true);
		} finally {
			(testDependencies as any).DamageRoll = originalDR;
			(testDependencies as any).reconstructEffectsTree = originalRecon;
		}
	});

	it('bug8b_no_prof_crit_suppressed: matching weaponType allows crit', async () => {
		const MockDamageRoll = makeMockDamageRollClass();
		const originalDR = testDependencies.DamageRoll;
		const originalRecon = testDependencies.reconstructEffectsTree;
		(testDependencies as any).DamageRoll = MockDamageRoll;
		(testDependencies as any).reconstructEffectsTree = (effects: EffectNode[]) => effects;
		ensureGameUserTargets();

		try {
			const actor = {
				uuid: 'a1',
				token: null,
				type: 'character',
				getRollData: () => ({}),
				system: { proficiencies: { weapons: ['Longsword'] } },
			};
			const item = {
				type: 'weapon',
				name: 'Longsword',
				actor,
				system: {
					weaponType: 'Longsword',
					properties: { selected: [] },
					activation: {
						effects: [],
						template: { shape: '', length: 1, radius: 1, width: 1 },
						targets: { count: 1, attackType: 'reach' },
					},
				},
			};
			const manager = new ItemActivationManager(item as any, { fastForward: true });
			manager.activationData = {
				effects: [
					{
						id: 'd1',
						type: 'damage',
						damageType: 'slashing',
						formula: '1d8',
						canCrit: true,
						canMiss: true,
						parentContext: null,
						parentNode: null,
					} as any,
				],
			};

			await manager.getData();

			const opts = (MockDamageRoll as any).calls[0].options;
			expect(opts.canCrit).toBe(true);
			expect(opts.canMiss).toBe(true);
		} finally {
			(testDependencies as any).DamageRoll = originalDR;
			(testDependencies as any).reconstructEffectsTree = originalRecon;
		}
	});
});
