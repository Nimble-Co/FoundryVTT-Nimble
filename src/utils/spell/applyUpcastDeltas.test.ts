import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScalingDelta, SpellScaling } from '#types/spellScaling.js';
import type { ConditionNode, DamageNode, HealingNode, SavingThrowNode } from '#types/effectTree.js';
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
			expect(result.error).toContain('Cantrips');
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
			expect(result.error).toContain('cannot be upcast');
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
			expect(result.error).toContain('Insufficient mana');
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
			expect(result.error).toContain('Must spend at least 3 mana');
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
			expect(result.error).toContain('Cannot spend more than 5 mana');
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

	describe('Delta Application - Various Operations', () => {
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
