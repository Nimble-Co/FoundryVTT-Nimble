import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConditionNode, DamageNode, HealingNode, SavingThrowNode } from '#types/effectTree.js';
import type { ScalingDelta, SpellScaling } from '#types/spellScaling.js';
import type { UpcastContext } from './applyUpcastDeltas.js';
import { applyUpcastDeltas, validateAndComputeUpcast } from './applyUpcastDeltas.js';

// Mock foundry.utils.deepClone and foundry.utils.randomID
globalThis.foundry = {
	utils: {
		deepClone: vi.fn((obj) => JSON.parse(JSON.stringify(obj))),
		randomID: vi.fn(() => `test-id-${Math.random().toString(36).substring(2, 11)}`),
	},
} as any;

// Helper to create a properly typed ScalingDelta with defaults
function createDelta(
	partial: Partial<ScalingDelta> & { operation: ScalingDelta['operation'] },
): ScalingDelta {
	return {
		operation: partial.operation,
		value: partial.value ?? null,
		dice: partial.dice ?? null,
		condition: partial.condition ?? null,
		targetEffectId: partial.targetEffectId ?? null,
		durationType: partial.durationType ?? null,
		maxDieFaces: partial.maxDieFaces ?? null,
	};
}

// Helper to create a properly typed SpellScaling
function createScaling(
	mode: SpellScaling['mode'],
	deltas: ScalingDelta[] = [],
	choices: SpellScaling['choices'] = null,
): SpellScaling {
	return { mode, deltas, choices };
}

describe('validateAndComputeUpcast', () => {
	describe('Validation Rules', () => {
		it('should reject cantrips (tier 0)', () => {
			const context: UpcastContext = {
				spell: { tier: 0, scaling: null },
				actor: { resources: { mana: { current: 10 }, highestUnlockedSpellTier: 9 } },
				activationData: { effects: [] },
				manaToSpend: 1,
			};

			const result = validateAndComputeUpcast(context);
			expect(result.valid).toBe(false);
			expect(result.refusal?.code).toBe('cantripCannotUpcast');
		});

		it('should reject spells without scaling', () => {
			const context: UpcastContext = {
				spell: { tier: 3, scaling: createScaling('none') },
				actor: { resources: { mana: { current: 10 }, highestUnlockedSpellTier: 9 } },
				activationData: { effects: [] },
				manaToSpend: 5,
			};

			const result = validateAndComputeUpcast(context);
			expect(result.valid).toBe(false);
			expect(result.refusal?.code).toBe('spellCannotUpcast');
		});

		it('should reject insufficient mana', () => {
			const context: UpcastContext = {
				spell: { tier: 3, scaling: createScaling('upcast') },
				actor: { resources: { mana: { current: 2 }, highestUnlockedSpellTier: 9 } },
				activationData: { effects: [] },
				manaToSpend: 5,
			};

			const result = validateAndComputeUpcast(context);
			expect(result.valid).toBe(false);
			expect(result.refusal?.code).toBe('insufficientMana');
		});

		it('should allow spending beyond current mana when mana cost enforcement is off', () => {
			const context: UpcastContext = {
				spell: { tier: 3, scaling: createScaling('upcast') },
				actor: { resources: { mana: { current: 0 }, highestUnlockedSpellTier: 9 } },
				activationData: { effects: [] },
				manaToSpend: 5,
				enforceManaCost: false,
			};

			const result = validateAndComputeUpcast(context);
			expect(result.valid).toBe(true);
			expect(result.upcastSteps).toBe(2);
			expect(result.totalMana).toBe(5);
		});

		it('should still enforce the unlocked tier ceiling when mana cost enforcement is off', () => {
			const context: UpcastContext = {
				spell: { tier: 3, scaling: createScaling('upcast') },
				actor: { resources: { mana: { current: 0 }, highestUnlockedSpellTier: 4 } },
				activationData: { effects: [] },
				manaToSpend: 5,
				enforceManaCost: false,
			};

			const result = validateAndComputeUpcast(context);
			expect(result.valid).toBe(false);
			expect(result.refusal?.code).toBe('aboveUnlockedTier');
		});

		it('should still require the base cost to be spent when mana cost enforcement is off', () => {
			const context: UpcastContext = {
				spell: { tier: 3, scaling: createScaling('upcast') },
				actor: { resources: { mana: { current: 0 }, highestUnlockedSpellTier: 9 } },
				activationData: { effects: [] },
				manaToSpend: 2,
				enforceManaCost: false,
			};

			const result = validateAndComputeUpcast(context);
			expect(result.valid).toBe(false);
			expect(result.refusal?.code).toBe('belowBaseTier');
		});

		it('should reject spending below base cost', () => {
			const context: UpcastContext = {
				spell: { tier: 3, scaling: createScaling('upcast') },
				actor: { resources: { mana: { current: 10 }, highestUnlockedSpellTier: 9 } },
				activationData: { effects: [] },
				manaToSpend: 2,
			};

			const result = validateAndComputeUpcast(context);
			expect(result.valid).toBe(false);
			expect(result.refusal?.code).toBe('belowBaseTier');
			expect(result.refusal?.data).toEqual({ min: '3' });
		});

		it('should reject spending above highest unlocked tier', () => {
			const context: UpcastContext = {
				spell: { tier: 3, scaling: createScaling('upcast') },
				actor: { resources: { mana: { current: 10 }, highestUnlockedSpellTier: 5 } },
				activationData: { effects: [] },
				manaToSpend: 6,
			};

			const result = validateAndComputeUpcast(context);
			expect(result.valid).toBe(false);
			expect(result.refusal?.code).toBe('aboveUnlockedTier');
			expect(result.refusal?.data).toEqual({ maxTier: '5' });
		});

		it('should validate correct upcast steps calculation', () => {
			const context: UpcastContext = {
				spell: { tier: 3, scaling: createScaling('upcast') },
				actor: { resources: { mana: { current: 10 }, highestUnlockedSpellTier: 9 } },
				activationData: { effects: [] },
				manaToSpend: 5,
			};

			const result = validateAndComputeUpcast(context);
			expect(result.valid).toBe(true);
			expect(result.upcastSteps).toBe(2);
			expect(result.baseMana).toBe(3);
			expect(result.totalMana).toBe(5);
		});
	});
});

describe('applyUpcastDeltas', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('Arc Lightning Scenario - addFlatDamage', () => {
		it('should add flat damage with 1 upcast step', () => {
			const context: UpcastContext = {
				spell: {
					tier: 1,
					scaling: createScaling('upcast', [createDelta({ operation: 'addFlatDamage', value: 4 })]),
				},
				actor: { resources: { mana: { current: 10 }, highestUnlockedSpellTier: 5 } },
				activationData: {
					effects: [
						{
							id: 'dmg1',
							type: 'damage',
							damageType: 'lightning',
							formula: '3d8',
							parentContext: null,
							parentNode: null,
						},
					],
				},
				manaToSpend: 2,
			};

			const result = applyUpcastDeltas(context);

			expect(result.upcastResult.upcastSteps).toBe(1);
			expect((result.activationData.effects[0] as DamageNode).formula).toBe('3d8+4');
		});

		it('should add flat damage with 8 upcast steps', () => {
			const context: UpcastContext = {
				spell: {
					tier: 1,
					scaling: createScaling('upcast', [createDelta({ operation: 'addFlatDamage', value: 4 })]),
				},
				actor: { resources: { mana: { current: 10 }, highestUnlockedSpellTier: 9 } },
				activationData: {
					effects: [
						{
							id: 'dmg1',
							type: 'damage',
							damageType: 'lightning',
							formula: '3d8',
							parentContext: null,
							parentNode: null,
						},
					],
				},
				manaToSpend: 9,
			};

			const result = applyUpcastDeltas(context);

			expect(result.upcastResult.upcastSteps).toBe(8);
			expect((result.activationData.effects[0] as DamageNode).formula).toBe('3d8+32');
		});
	});

	describe('Heal Scenario - upcastChoice', () => {
		const healChoices = [
			{ label: '+1 target', deltas: [createDelta({ operation: 'addTargets', value: 1 })] },
			{ label: '+4 Reach', deltas: [createDelta({ operation: 'addReach', value: 4 })] },
			{
				label: '+1d6 healing',
				deltas: [createDelta({ operation: 'addDice', dice: { count: 1, faces: 6 } })],
			},
		];

		it('should apply target choice (+2 targets for 2 steps)', () => {
			const context: UpcastContext = {
				spell: {
					tier: 1,
					scaling: createScaling('upcastChoice', [], healChoices),
				},
				actor: { resources: { mana: { current: 10 }, highestUnlockedSpellTier: 5 } },
				activationData: {
					effects: [
						{
							id: 'heal1',
							type: 'healing',
							healingType: 'healing',
							formula: '1d6+@key',
							parentContext: null,
							parentNode: null,
						},
					],
					targets: { count: 1, restrictions: '', attackType: '', distance: 2 },
				},
				manaToSpend: 3,
				choiceIndex: 0,
			};

			const result = applyUpcastDeltas(context);

			expect(result.upcastResult.upcastSteps).toBe(2);
			expect(result.activationData.targets?.count).toBe(3);
		});

		it('should apply reach choice (+8 reach for 2 steps)', () => {
			const context: UpcastContext = {
				spell: {
					tier: 1,
					scaling: createScaling('upcastChoice', [], healChoices),
				},
				actor: { resources: { mana: { current: 10 }, highestUnlockedSpellTier: 5 } },
				activationData: {
					effects: [
						{
							id: 'heal1',
							type: 'healing',
							healingType: 'healing',
							formula: '1d6+@key',
							parentContext: null,
							parentNode: null,
						},
					],
					targets: { count: 1, restrictions: '', attackType: 'reach', distance: 2 },
				},
				manaToSpend: 3,
				choiceIndex: 1,
			};

			const result = applyUpcastDeltas(context);

			expect(result.upcastResult.upcastSteps).toBe(2);
			expect(result.activationData.targets?.distance).toBe(10);
		});

		it('should apply healing choice (+2d6 healing for 2 steps)', () => {
			const context: UpcastContext = {
				spell: {
					tier: 1,
					scaling: createScaling('upcastChoice', [], healChoices),
				},
				actor: { resources: { mana: { current: 10 }, highestUnlockedSpellTier: 5 } },
				activationData: {
					effects: [
						{
							id: 'heal1',
							type: 'healing',
							healingType: 'healing',
							formula: '1d6+@key',
							parentContext: null,
							parentNode: null,
						},
					],
					targets: { count: 1, restrictions: '', attackType: '', distance: 2 },
				},
				manaToSpend: 3,
				choiceIndex: 2,
			};

			const result = applyUpcastDeltas(context);

			expect(result.upcastResult.upcastSteps).toBe(2);
			expect((result.activationData.effects[0] as HealingNode).formula).toBe('1d6+@key+2d6');
		});
	});

	describe('Lifebinding Spirit Scenario - increaseDieSize', () => {
		function createDieSizeContext(manaToSpend: number, formula = '1d6+@abilities.wil.mod') {
			return {
				spell: {
					tier: 1,
					scaling: createScaling('upcast', [
						createDelta({ operation: 'increaseDieSize', value: 1, maxDieFaces: 12 }),
					]),
				},
				actor: { resources: { mana: { current: 20 }, highestUnlockedSpellTier: 9 } },
				activationData: {
					effects: [
						{
							id: 'dmg1',
							type: 'damage',
							damageType: 'radiant',
							formula,
							parentContext: null,
							parentNode: null,
						},
					],
				},
				manaToSpend,
			} as UpcastContext;
		}

		it('should enlarge the existing die instead of appending a new term', () => {
			const result = applyUpcastDeltas(createDieSizeContext(2));

			expect(result.upcastResult.upcastSteps).toBe(1);
			expect((result.activationData.effects[0] as DamageNode).formula).toBe(
				'1d8+@abilities.wil.mod',
			);
		});

		it('should step once per point of mana above the base tier', () => {
			const result = applyUpcastDeltas(createDieSizeContext(4));

			expect(result.upcastResult.upcastSteps).toBe(3);
			expect((result.activationData.effects[0] as DamageNode).formula).toBe(
				'1d12+@abilities.wil.mod',
			);
		});

		it('should stop at the configured maximum die size', () => {
			const result = applyUpcastDeltas(createDieSizeContext(9));

			expect(result.upcastResult.upcastSteps).toBe(8);
			expect((result.activationData.effects[0] as DamageNode).formula).toBe(
				'1d12+@abilities.wil.mod',
			);
		});

		it('should leave the formula unchanged when cast at base tier', () => {
			const result = applyUpcastDeltas(createDieSizeContext(1));

			expect(result.upcastResult.upcastSteps).toBe(0);
			expect((result.activationData.effects[0] as DamageNode).formula).toBe(
				'1d6+@abilities.wil.mod',
			);
		});
	});

	describe('Delta Application - Various Operations', () => {
		it('should increase the die size of a healing effect', () => {
			const context: UpcastContext = {
				spell: {
					tier: 1,
					scaling: createScaling('upcast', [
						createDelta({ operation: 'increaseDieSize', value: 1, maxDieFaces: 12 }),
					]),
				},
				actor: { resources: { mana: { current: 10 }, highestUnlockedSpellTier: 5 } },
				activationData: {
					effects: [
						{
							id: 'heal1',
							type: 'healing',
							healingType: 'healing',
							formula: '2d4',
							parentContext: null,
							parentNode: null,
						},
					],
				},
				manaToSpend: 3,
			};

			const result = applyUpcastDeltas(context);

			expect((result.activationData.effects[0] as HealingNode).formula).toBe('2d8');
		});

		it('should increase the die size of the targeted effect only', () => {
			const context: UpcastContext = {
				spell: {
					tier: 1,
					scaling: createScaling('upcast', [
						createDelta({
							operation: 'increaseDieSize',
							value: 1,
							maxDieFaces: 12,
							targetEffectId: 'dmg2',
						}),
					]),
				},
				actor: { resources: { mana: { current: 10 }, highestUnlockedSpellTier: 5 } },
				activationData: {
					effects: [
						{
							id: 'dmg1',
							type: 'damage',
							damageType: 'fire',
							formula: '1d6',
							parentContext: null,
							parentNode: null,
						},
						{
							id: 'dmg2',
							type: 'damage',
							damageType: 'radiant',
							formula: '1d6',
							parentContext: null,
							parentNode: null,
						},
					],
				},
				manaToSpend: 2,
			};

			const result = applyUpcastDeltas(context);

			expect((result.activationData.effects[0] as DamageNode).formula).toBe('1d6');
			expect((result.activationData.effects[1] as DamageNode).formula).toBe('1d8');
		});

		it('should apply multiple die-size steps per upcast level', () => {
			const context: UpcastContext = {
				spell: {
					tier: 1,
					scaling: createScaling('upcast', [
						createDelta({ operation: 'increaseDieSize', value: 2, maxDieFaces: 20 }),
					]),
				},
				actor: { resources: { mana: { current: 10 }, highestUnlockedSpellTier: 5 } },
				activationData: {
					effects: [
						{
							id: 'dmg1',
							type: 'damage',
							damageType: 'fire',
							formula: '1d4',
							parentContext: null,
							parentNode: null,
						},
					],
				},
				manaToSpend: 3,
			};

			const result = applyUpcastDeltas(context);

			// 2 upcast steps x 2 die steps each: d4 -> d6 -> d8 -> d10 -> d12
			expect((result.activationData.effects[0] as DamageNode).formula).toBe('1d12');
		});

		it('should not throw when increaseDieSize finds no damage or healing effect', () => {
			const context: UpcastContext = {
				spell: {
					tier: 1,
					scaling: createScaling('upcast', [
						createDelta({ operation: 'increaseDieSize', value: 1, maxDieFaces: 12 }),
					]),
				},
				actor: { resources: { mana: { current: 10 }, highestUnlockedSpellTier: 5 } },
				activationData: { effects: [] },
				manaToSpend: 3,
			};

			expect(() => applyUpcastDeltas(context)).not.toThrow();
		});

		it('should add dice correctly', () => {
			const context: UpcastContext = {
				spell: {
					tier: 2,
					scaling: createScaling('upcast', [
						createDelta({ operation: 'addDice', dice: { count: 2, faces: 8 } }),
					]),
				},
				actor: { resources: { mana: { current: 10 }, highestUnlockedSpellTier: 5 } },
				activationData: {
					effects: [
						{
							id: 'dmg1',
							type: 'damage',
							damageType: 'fire',
							formula: '4d6',
							parentContext: null,
							parentNode: null,
						},
					],
				},
				manaToSpend: 4,
			};

			const result = applyUpcastDeltas(context);

			expect(result.upcastResult.upcastSteps).toBe(2);
			expect((result.activationData.effects[0] as DamageNode).formula).toBe('4d6+4d8');
		});

		it('should increase saving throw DC', () => {
			const context: UpcastContext = {
				spell: {
					tier: 2,
					scaling: createScaling('upcast', [createDelta({ operation: 'addDC', value: 1 })]),
				},
				actor: { resources: { mana: { current: 10 }, highestUnlockedSpellTier: 5 } },
				activationData: {
					effects: [
						{
							id: 'save1',
							type: 'savingThrow',
							savingThrowType: 'strength',
							saveDC: 12,
							parentContext: null,
							parentNode: null,
						},
					],
				},
				manaToSpend: 4,
			};

			const result = applyUpcastDeltas(context);

			expect(result.upcastResult.upcastSteps).toBe(2);
			expect((result.activationData.effects[0] as SavingThrowNode).saveDC).toBe(14);
		});

		it('should increase area size (radius)', () => {
			const context: UpcastContext = {
				spell: {
					tier: 2,
					scaling: createScaling('upcast', [createDelta({ operation: 'addAreaSize', value: 2 })]),
				},
				actor: { resources: { mana: { current: 10 }, highestUnlockedSpellTier: 5 } },
				activationData: {
					effects: [],
					template: { shape: 'circle', radius: 4 },
				},
				manaToSpend: 4,
			};

			const result = applyUpcastDeltas(context);

			expect(result.upcastResult.upcastSteps).toBe(2);
			expect(result.activationData.template?.radius).toBe(8);
		});

		it('should increase area size (length)', () => {
			const context: UpcastContext = {
				spell: {
					tier: 2,
					scaling: createScaling('upcast', [createDelta({ operation: 'addAreaSize', value: 3 })]),
				},
				actor: { resources: { mana: { current: 10 }, highestUnlockedSpellTier: 5 } },
				activationData: {
					effects: [],
					template: { shape: 'line', length: 10, width: 1 },
				},
				manaToSpend: 3,
			};

			const result = applyUpcastDeltas(context);

			expect(result.upcastResult.upcastSteps).toBe(1);
			expect(result.activationData.template?.length).toBe(13);
		});

		it('should increase duration', () => {
			const context: UpcastContext = {
				spell: {
					tier: 2,
					scaling: createScaling('upcast', [createDelta({ operation: 'addDuration', value: 1 })]),
				},
				actor: { resources: { mana: { current: 10 }, highestUnlockedSpellTier: 5 } },
				activationData: {
					effects: [],
					duration: { details: '', quantity: 3, type: 'round' },
				},
				manaToSpend: 4,
			};

			const result = applyUpcastDeltas(context);

			expect(result.upcastResult.upcastSteps).toBe(2);
			expect(result.activationData.duration?.quantity).toBe(5);
		});

		it('should increase range', () => {
			const context: UpcastContext = {
				spell: {
					tier: 2,
					scaling: createScaling('upcast', [createDelta({ operation: 'addRange', value: 5 })]),
				},
				actor: { resources: { mana: { current: 10 }, highestUnlockedSpellTier: 5 } },
				activationData: {
					effects: [],
					targets: { count: 1, restrictions: '', attackType: 'range', distance: 10 },
				},
				manaToSpend: 4,
			};

			const result = applyUpcastDeltas(context);

			expect(result.upcastResult.upcastSteps).toBe(2);
			expect(result.activationData.targets?.distance).toBe(20);
		});

		it('should add condition', () => {
			const context: UpcastContext = {
				spell: {
					tier: 2,
					scaling: createScaling('upcast', [
						createDelta({ operation: 'addCondition', condition: 'burning' }),
					]),
				},
				actor: { resources: { mana: { current: 10 }, highestUnlockedSpellTier: 5 } },
				activationData: {
					effects: [],
				},
				manaToSpend: 3,
			};

			const result = applyUpcastDeltas(context);

			expect(result.upcastResult.upcastSteps).toBe(1);
			expect(result.activationData.effects.length).toBe(1);
			expect(result.activationData.effects[0].type).toBe('condition');
			expect((result.activationData.effects[0] as ConditionNode).condition).toBe('burning');
		});
	});

	describe('Edge Cases', () => {
		it('should apply multiple deltas in a single upcast', () => {
			const context: UpcastContext = {
				spell: {
					tier: 1,
					scaling: createScaling('upcast', [
						createDelta({ operation: 'addFlatDamage', value: 4 }),
						createDelta({ operation: 'addTargets', value: 1 }),
					]),
				},
				actor: { resources: { mana: { current: 10 }, highestUnlockedSpellTier: 5 } },
				activationData: {
					effects: [
						{
							id: 'dmg1',
							type: 'damage',
							damageType: 'fire',
							formula: '2d6',
							parentContext: null,
							parentNode: null,
						},
					],
					targets: { count: 1, restrictions: '', attackType: '', distance: 2 },
				},
				manaToSpend: 3,
			};

			const result = applyUpcastDeltas(context);

			expect(result.upcastResult.upcastSteps).toBe(2);
			expect((result.activationData.effects[0] as DamageNode).formula).toBe('2d6+8');
			expect(result.activationData.targets?.count).toBe(3);
		});

		it('should target specific effect by targetEffectId', () => {
			const context: UpcastContext = {
				spell: {
					tier: 2,
					scaling: createScaling('upcast', [
						createDelta({ operation: 'addFlatDamage', value: 3, targetEffectId: 'secondary' }),
					]),
				},
				actor: { resources: { mana: { current: 10 }, highestUnlockedSpellTier: 5 } },
				activationData: {
					effects: [
						{
							id: 'primary',
							type: 'damage',
							damageType: 'fire',
							formula: '4d6',
							parentContext: null,
							parentNode: null,
						},
						{
							id: 'secondary',
							type: 'damage',
							damageType: 'cold',
							formula: '2d8',
							parentContext: null,
							parentNode: null,
						},
					],
				},
				manaToSpend: 3,
			};

			const result = applyUpcastDeltas(context);

			expect((result.activationData.effects[0] as DamageNode).formula).toBe('4d6');
			expect((result.activationData.effects[1] as DamageNode).formula).toBe('2d8+3');
		});

		it('should handle casting at exactly max tier', () => {
			const context: UpcastContext = {
				spell: { tier: 3, scaling: createScaling('upcast') },
				actor: { resources: { mana: { current: 10 }, highestUnlockedSpellTier: 5 } },
				activationData: { effects: [] },
				manaToSpend: 5,
			};

			const result = validateAndComputeUpcast(context);
			expect(result.valid).toBe(true);
			expect(result.upcastSteps).toBe(2);
			expect(result.totalMana).toBe(5);
		});

		it('should skip delta gracefully when no matching effect exists', () => {
			const context: UpcastContext = {
				spell: {
					tier: 1,
					scaling: createScaling('upcast', [createDelta({ operation: 'addFlatDamage', value: 5 })]),
				},
				actor: { resources: { mana: { current: 10 }, highestUnlockedSpellTier: 5 } },
				activationData: {
					effects: [],
				},
				manaToSpend: 2,
			};

			const result = applyUpcastDeltas(context);

			expect(result.upcastResult.upcastSteps).toBe(1);
			expect(result.activationData.effects.length).toBe(0);
		});

		it('should append dice to formula with existing modifiers', () => {
			const context: UpcastContext = {
				spell: {
					tier: 1,
					scaling: createScaling('upcast', [
						createDelta({ operation: 'addDice', dice: { count: 1, faces: 8 } }),
					]),
				},
				actor: { resources: { mana: { current: 10 }, highestUnlockedSpellTier: 5 } },
				activationData: {
					effects: [
						{
							id: 'dmg1',
							type: 'damage',
							damageType: 'fire',
							formula: '3d8+@key',
							parentContext: null,
							parentNode: null,
						},
					],
				},
				manaToSpend: 3,
			};

			const result = applyUpcastDeltas(context);

			expect((result.activationData.effects[0] as DamageNode).formula).toBe('3d8+@key+2d8');
		});

		it('should skip addDuration when duration is missing', () => {
			const context: UpcastContext = {
				spell: {
					tier: 1,
					scaling: createScaling('upcast', [createDelta({ operation: 'addDuration', value: 1 })]),
				},
				actor: { resources: { mana: { current: 10 }, highestUnlockedSpellTier: 5 } },
				activationData: {
					effects: [],
				},
				manaToSpend: 2,
			};

			const result = applyUpcastDeltas(context);

			expect(result.upcastResult.upcastSteps).toBe(1);
			expect(result.activationData.duration).toBeUndefined();
		});

		it('should skip addAreaSize when template is missing', () => {
			const context: UpcastContext = {
				spell: {
					tier: 1,
					scaling: createScaling('upcast', [createDelta({ operation: 'addAreaSize', value: 2 })]),
				},
				actor: { resources: { mana: { current: 10 }, highestUnlockedSpellTier: 5 } },
				activationData: {
					effects: [],
				},
				manaToSpend: 2,
			};

			const result = applyUpcastDeltas(context);

			expect(result.upcastResult.upcastSteps).toBe(1);
			expect(result.activationData.template).toBeUndefined();
		});

		it('should be a no-op for addArmor (not yet implemented)', () => {
			const context: UpcastContext = {
				spell: {
					tier: 2,
					scaling: createScaling('upcast', [createDelta({ operation: 'addArmor', value: 2 })]),
				},
				actor: { resources: { mana: { current: 10 }, highestUnlockedSpellTier: 5 } },
				activationData: {
					effects: [],
				},
				manaToSpend: 4,
			};

			const result = applyUpcastDeltas(context);

			expect(result.upcastResult.upcastSteps).toBe(2);
			expect(result.activationData.effects.length).toBe(0);
		});
	});

	describe('Nested Effect Node Lookup', () => {
		it('should find damage node inside savingThrow.on.failedSave (Gangrenous Burst pattern)', () => {
			const context: UpcastContext = {
				spell: {
					tier: 5,
					scaling: createScaling('upcast', [
						createDelta({ operation: 'addFlatDamage', value: 10, targetEffectId: 'nestedDmg' }),
					]),
				},
				actor: { resources: { mana: { current: 10 }, highestUnlockedSpellTier: 9 } },
				activationData: {
					effects: [
						{
							id: 'save1',
							type: 'savingThrow',
							savingThrowType: 'strength',
							saveType: 'strength',
							parentContext: null,
							parentNode: null,
							on: {
								failedSave: [
									{
										id: 'nestedDmg',
										type: 'damage',
										damageType: 'necrotic',
										formula: '3d20',
										parentContext: 'failedSave',
										parentNode: 'save1',
										ignoreArmor: true,
									},
								],
							},
							sharedRolls: [],
						},
					],
				},
				manaToSpend: 6,
			};

			const result = applyUpcastDeltas(context);

			expect(result.upcastResult.upcastSteps).toBe(1);
			const saveNode = result.activationData.effects[0] as any;
			expect(saveNode.on.failedSave[0].formula).toBe('3d20+10');
		});

		it('should find savingThrow node inside damage.on.hit (Vampiric Greed pattern)', () => {
			const context: UpcastContext = {
				spell: {
					tier: 3,
					scaling: createScaling('upcast', [
						createDelta({ operation: 'addDC', value: 1, targetEffectId: 'nestedSave' }),
					]),
				},
				actor: { resources: { mana: { current: 10 }, highestUnlockedSpellTier: 9 } },
				activationData: {
					effects: [
						{
							id: 'dmg1',
							type: 'damage',
							damageType: 'necrotic',
							formula: '4d12',
							parentContext: null,
							parentNode: null,
							canCrit: false,
							canMiss: false,
							on: {
								hit: [
									{
										id: 'nestedSave',
										type: 'savingThrow',
										savingThrowType: 'strength',
										saveType: 'strength',
										parentContext: 'hit',
										parentNode: 'dmg1',
										saveDC: 0,
										on: {},
										sharedRolls: [],
									},
								],
							},
						},
					],
				},
				manaToSpend: 5,
			};

			const result = applyUpcastDeltas(context);

			expect(result.upcastResult.upcastSteps).toBe(2);
			const dmgNode = result.activationData.effects[0] as any;
			expect(dmgNode.on.hit[0].saveDC).toBe(2);
		});

		it('should apply both addDC and addFlatDamage to nested nodes (Unspeakable Word pattern)', () => {
			const context: UpcastContext = {
				spell: {
					tier: 6,
					scaling: createScaling('upcast', [
						createDelta({ operation: 'addDC', value: 1, targetEffectId: 'topSave' }),
						createDelta({ operation: 'addFlatDamage', value: 10, targetEffectId: 'nestedDmg' }),
					]),
				},
				actor: { resources: { mana: { current: 10 }, highestUnlockedSpellTier: 9 } },
				activationData: {
					effects: [
						{
							id: 'topSave',
							type: 'savingThrow',
							savingThrowType: 'strength',
							saveType: 'intelligence',
							saveDC: 0,
							parentContext: null,
							parentNode: null,
							on: {
								failedSave: [
									{
										id: 'nestedDmg',
										type: 'damage',
										damageType: 'necrotic',
										formula: '3d6+10',
										parentContext: 'failedSave',
										parentNode: 'topSave',
										ignoreArmor: true,
									},
								],
							},
							sharedRolls: [],
						},
					],
				},
				manaToSpend: 8,
			};

			const result = applyUpcastDeltas(context);

			expect(result.upcastResult.upcastSteps).toBe(2);
			const saveNode = result.activationData.effects[0] as any;
			expect(saveNode.saveDC).toBe(2);
			expect(saveNode.on.failedSave[0].formula).toBe('3d6+10+20');
		});

		it('should find damage node nested inside savingThrow within damage.on.hit (Pyroclasm pattern)', () => {
			const context: UpcastContext = {
				spell: {
					tier: 4,
					scaling: createScaling('upcast', [
						createDelta({ operation: 'addFlatDamage', value: 2, targetEffectId: 'deepDmg' }),
					]),
				},
				actor: { resources: { mana: { current: 10 }, highestUnlockedSpellTier: 9 } },
				activationData: {
					effects: [
						{
							id: 'topSave',
							type: 'savingThrow',
							savingThrowType: 'strength',
							saveType: 'dexterity',
							parentContext: null,
							parentNode: null,
							on: {
								failedSave: [
									{
										id: 'deepDmg',
										type: 'damage',
										damageType: 'fire',
										formula: '2d20+10',
										parentContext: 'failedSave',
										parentNode: 'topSave',
										ignoreArmor: true,
									},
								],
							},
							sharedRolls: [],
						},
					],
				},
				manaToSpend: 6,
			};

			const result = applyUpcastDeltas(context);

			expect(result.upcastResult.upcastSteps).toBe(2);
			const saveNode = result.activationData.effects[0] as any;
			expect(saveNode.on.failedSave[0].formula).toBe('2d20+10+4');
		});

		it('should not match nested node when targetEffectId does not exist', () => {
			const context: UpcastContext = {
				spell: {
					tier: 3,
					scaling: createScaling('upcast', [
						createDelta({ operation: 'addFlatDamage', value: 5, targetEffectId: 'nonexistent' }),
					]),
				},
				actor: { resources: { mana: { current: 10 }, highestUnlockedSpellTier: 9 } },
				activationData: {
					effects: [
						{
							id: 'save1',
							type: 'savingThrow',
							savingThrowType: 'strength',
							saveType: 'strength',
							parentContext: null,
							parentNode: null,
							on: {
								failedSave: [
									{
										id: 'realDmg',
										type: 'damage',
										damageType: 'fire',
										formula: '3d8',
										parentContext: 'failedSave',
										parentNode: 'save1',
									},
								],
							},
							sharedRolls: [],
						},
					],
				},
				manaToSpend: 4,
			};

			const result = applyUpcastDeltas(context);

			// Should not modify anything since targetEffectId doesn't match
			const saveNode = result.activationData.effects[0] as any;
			expect(saveNode.on.failedSave[0].formula).toBe('3d8');
		});
	});

	describe('Immutability Tests', () => {
		it('should not mutate original activation data', () => {
			const originalActivationData = {
				effects: [
					{
						id: 'dmg1',
						type: 'damage',
						damageType: 'fire',
						formula: '3d8',
						parentContext: null,
						parentNode: null,
					},
				],
				targets: { count: 1, restrictions: '', attackType: '', distance: 2 },
			};

			const context: UpcastContext = {
				spell: {
					tier: 1,
					scaling: createScaling('upcast', [
						createDelta({ operation: 'addFlatDamage', value: 5 }),
						createDelta({ operation: 'addTargets', value: 1 }),
					]),
				},
				actor: { resources: { mana: { current: 10 }, highestUnlockedSpellTier: 5 } },
				activationData: originalActivationData as any,
				manaToSpend: 3,
			};

			const result = applyUpcastDeltas(context);

			// Original should not be modified
			expect((originalActivationData.effects[0] as DamageNode).formula).toBe('3d8');
			expect(originalActivationData.targets.count).toBe(1);

			// Result should have modifications
			expect((result.activationData.effects[0] as DamageNode).formula).toBe('3d8+10');
			expect(result.activationData.targets?.count).toBe(3);
		});
	});

	describe('Error Handling', () => {
		it('should throw error for upcastChoice without choiceIndex', () => {
			const context: UpcastContext = {
				spell: {
					tier: 1,
					scaling: createScaling(
						'upcastChoice',
						[],
						[
							{
								label: 'Option 1',
								deltas: [createDelta({ operation: 'addFlatDamage', value: 5 })],
							},
						],
					),
				},
				actor: { resources: { mana: { current: 10 }, highestUnlockedSpellTier: 5 } },
				activationData: { effects: [] },
				manaToSpend: 2,
			};

			expect(() => applyUpcastDeltas(context)).toThrow('Choice index required');
		});

		it('should throw error for invalid validation', () => {
			const context: UpcastContext = {
				spell: { tier: 0, scaling: null },
				actor: { resources: { mana: { current: 10 }, highestUnlockedSpellTier: 5 } },
				activationData: { effects: [] },
				manaToSpend: 1,
			};

			expect(() => applyUpcastDeltas(context)).toThrow('Cantrips cannot be upcast');
		});
	});
});
