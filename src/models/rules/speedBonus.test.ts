import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SpeedBonusRule } from './speedBonus.js';

/**
 * Creates a mock actor with movement attributes
 */
function createMockActor(
	movement: Record<string, number> = { walk: 6, fly: 0, climb: 0, swim: 0, burrow: 0 },
) {
	return {
		system: {
			attributes: {
				movement: { ...movement },
			},
		},
		getRollData: vi.fn(() => ({
			attributes: {
				movement: { ...movement },
			},
		})),
	};
}

/**
 * Creates a mock item that contains the rule
 */
function createMockItem(actor: ReturnType<typeof createMockActor>) {
	return {
		isEmbedded: true,
		actor,
		name: 'Test Item',
		uuid: 'test-item-uuid',
	};
}

/**
 * Creates a SpeedBonusRule instance with the given configuration
 */
function createSpeedBonusRule(
	config: {
		value: string;
		movementType?: string;
		disabled?: boolean;
		label?: string;
	},
	actor: ReturnType<typeof createMockActor>,
) {
	const item = createMockItem(actor);

	const sourceData = {
		value: config.value,
		movementType: config.movementType,
		disabled: config.disabled ?? false,
		label: config.label ?? 'Test Rule',
		id: 'test-rule-id',
		identifier: '',
		priority: 1,
		predicate: {},
		type: 'speedBonus',
	};

	// Create the rule with a mock parent
	const rule = new SpeedBonusRule(sourceData as any, { parent: item as any, strict: false });

	// Manually set properties since the mock DataModel doesn't do this automatically
	(rule as any).value = config.value;
	(rule as any).movementType = config.movementType ?? 'walk';
	(rule as any).disabled = config.disabled ?? false;
	(rule as any).label = config.label ?? 'Test Rule';

	// Override the _source to control hasExplicitMovementType() behavior
	if (config.movementType !== undefined) {
		(rule as any)._source = { movementType: config.movementType };
	} else {
		(rule as any)._source = {};
	}

	// Override the item getter to return our mock
	Object.defineProperty(rule, 'item', {
		get: () => item,
		configurable: true,
	});

	return rule;
}

describe('SpeedBonusRule', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('prePrepareData (numeric bonuses)', () => {
		it('should apply positive numeric bonus to walk speed', () => {
			const actor = createMockActor({ walk: 6, fly: 0, climb: 0, swim: 0, burrow: 0 });
			const rule = createSpeedBonusRule({ value: '1' }, actor);

			rule.prePrepareData();

			expect(actor.system.attributes.movement.walk).toBe(7);
		});

		it('should apply negative numeric bonus to walk speed', () => {
			const actor = createMockActor({ walk: 6, fly: 0, climb: 0, swim: 0, burrow: 0 });
			const rule = createSpeedBonusRule({ value: '-1' }, actor);

			rule.prePrepareData();

			expect(actor.system.attributes.movement.walk).toBe(5);
		});

		it('should not reduce walk speed below 0', () => {
			const actor = createMockActor({ walk: 2, fly: 0, climb: 0, swim: 0, burrow: 0 });
			const rule = createSpeedBonusRule({ value: '-5' }, actor);

			rule.prePrepareData();

			expect(actor.system.attributes.movement.walk).toBe(0);
		});

		it('should apply bonus to specific movement type when movementType is set', () => {
			const actor = createMockActor({ walk: 6, fly: 0, climb: 0, swim: 0, burrow: 0 });
			const rule = createSpeedBonusRule({ value: '3', movementType: 'climb' }, actor);

			rule.prePrepareData();

			expect(actor.system.attributes.movement.climb).toBe(3);
			expect(actor.system.attributes.movement.walk).toBe(6); // Unchanged
		});

		it('should stack multiple numeric bonuses to walk', () => {
			const actor = createMockActor({ walk: 6, fly: 0, climb: 0, swim: 0, burrow: 0 });

			// Apply first bonus: Elf +1
			const elfRule = createSpeedBonusRule({ value: '1', label: 'Lithe' }, actor);
			elfRule.prePrepareData();
			expect(actor.system.attributes.movement.walk).toBe(7);

			// Apply second bonus: Epic Speed +4
			const epicRule = createSpeedBonusRule({ value: '4', label: 'Epic Speed' }, actor);
			epicRule.prePrepareData();
			expect(actor.system.attributes.movement.walk).toBe(11);
		});

		it('should not process formula values in prePrepareData', () => {
			const actor = createMockActor({ walk: 6, fly: 0, climb: 0, swim: 0, burrow: 0 });
			const rule = createSpeedBonusRule(
				{ value: '@attributes.movement.walk', movementType: 'climb' },
				actor,
			);

			rule.prePrepareData();

			// Formula values should be skipped in prePrepareData
			expect(actor.system.attributes.movement.climb).toBe(0);
		});

		it('should use default walk speed of 6 when not set', () => {
			const actor = createMockActor({} as any);
			actor.system.attributes.movement = {} as any;
			const rule = createSpeedBonusRule({ value: '2' }, actor);

			rule.prePrepareData();

			expect(actor.system.attributes.movement.walk).toBe(8); // 6 default + 2
		});
	});

	describe('afterPrepareData (formula-based bonuses)', () => {
		it('should process formula values in afterPrepareData', () => {
			const actor = createMockActor({ walk: 8, fly: 0, climb: 0, swim: 0, burrow: 0 });
			// Update getRollData to return the current walk value
			actor.getRollData = vi.fn(() => ({
				attributes: {
					movement: actor.system.attributes.movement,
				},
			}));
			const rule = createSpeedBonusRule(
				{ value: '@attributes.movement.walk', movementType: 'climb' },
				actor,
			);

			rule.afterPrepareData();

			// Climb should equal walk (8)
			expect(actor.system.attributes.movement.climb).toBe(8);
		});

		it('should not process numeric values in afterPrepareData', () => {
			const actor = createMockActor({ walk: 6, fly: 0, climb: 0, swim: 0, burrow: 0 });
			const rule = createSpeedBonusRule({ value: '2' }, actor);

			rule.afterPrepareData();

			// Numeric values should be skipped in afterPrepareData (already processed in prePrepareData)
			expect(actor.system.attributes.movement.walk).toBe(6);
		});

		it('should apply generic formula bonus to walk only', () => {
			const actor = createMockActor({ walk: 6, fly: 0, climb: 0, swim: 0, burrow: 0 });
			actor.getRollData = vi.fn(() => ({
				level: 5,
			}));
			// Generic formula bonus (no explicit movementType)
			const rule = createSpeedBonusRule({ value: '@level' }, actor);
			// Remove movementType from _source to make it generic
			(rule as any)._source = {};

			rule.afterPrepareData();

			// Formula @level = 5 should be added to walk
			expect(actor.system.attributes.movement.walk).toBe(11);
		});
	});

	describe('two-phase processing', () => {
		it('should ensure climb speed equals fully modified walk speed', () => {
			// Scenario: Elf (+1) with Explorer of the Wilds (+2 walk, climb = walk) and Epic Speed (+4)
			// Expected: walk = 6 + 1 + 2 + 4 = 13, climb = 13
			const actor = createMockActor({ walk: 6, fly: 0, climb: 0, swim: 0, burrow: 0 });

			// Phase 1: Apply numeric bonuses
			const elfRule = createSpeedBonusRule({ value: '1', label: 'Elf Lithe' }, actor);
			elfRule.prePrepareData();
			expect(actor.system.attributes.movement.walk).toBe(7);

			const explorerWalkRule = createSpeedBonusRule(
				{ value: '2', label: 'Explorer of the Wilds' },
				actor,
			);
			explorerWalkRule.prePrepareData();
			expect(actor.system.attributes.movement.walk).toBe(9);

			const epicSpeedRule = createSpeedBonusRule({ value: '4', label: 'Epic Speed' }, actor);
			epicSpeedRule.prePrepareData();
			expect(actor.system.attributes.movement.walk).toBe(13);

			// Phase 2: Apply formula bonuses (climb = walk)
			// Update getRollData to return current movement values
			actor.getRollData = vi.fn(() => ({
				attributes: {
					movement: actor.system.attributes.movement,
				},
			}));

			const explorerClimbRule = createSpeedBonusRule(
				{
					value: '@attributes.movement.walk',
					movementType: 'climb',
					label: 'Explorer of the Wilds',
				},
				actor,
			);
			explorerClimbRule.afterPrepareData();

			// Climb should now equal the fully modified walk speed
			expect(actor.system.attributes.movement.climb).toBe(13);
		});
	});

	describe('movement type handling', () => {
		it('should apply fly speed bonus', () => {
			const actor = createMockActor({ walk: 6, fly: 0, climb: 0, swim: 0, burrow: 0 });
			const rule = createSpeedBonusRule({ value: '6', movementType: 'fly' }, actor);

			rule.prePrepareData();

			expect(actor.system.attributes.movement.fly).toBe(6);
		});

		it('should apply swim speed bonus', () => {
			const actor = createMockActor({ walk: 6, fly: 0, climb: 0, swim: 0, burrow: 0 });
			const rule = createSpeedBonusRule({ value: '4', movementType: 'swim' }, actor);

			rule.prePrepareData();

			expect(actor.system.attributes.movement.swim).toBe(4);
		});

		it('should apply burrow speed bonus', () => {
			const actor = createMockActor({ walk: 6, fly: 0, climb: 0, swim: 0, burrow: 0 });
			const rule = createSpeedBonusRule({ value: '3', movementType: 'burrow' }, actor);

			rule.prePrepareData();

			expect(actor.system.attributes.movement.burrow).toBe(3);
		});

		it('should add to existing movement speed', () => {
			const actor = createMockActor({ walk: 6, fly: 4, climb: 0, swim: 0, burrow: 0 });
			const rule = createSpeedBonusRule({ value: '2', movementType: 'fly' }, actor);

			rule.prePrepareData();

			expect(actor.system.attributes.movement.fly).toBe(6); // 4 + 2
		});
	});

	describe('edge cases', () => {
		it('should handle non-embedded items gracefully', () => {
			const actor = createMockActor({ walk: 6, fly: 0, climb: 0, swim: 0, burrow: 0 });
			const item = {
				isEmbedded: false, // Not embedded
				actor,
				name: 'Test Item',
				uuid: 'test-item-uuid',
			};

			const rule = new SpeedBonusRule(
				{
					value: '2',
					movementType: 'walk',
					disabled: false,
					label: 'Test Rule',
					id: 'test-rule-id',
					identifier: '',
					priority: 1,
					predicate: {},
					type: 'speedBonus',
				} as any,
				{ parent: item as any, strict: false },
			);

			// Manually set properties
			(rule as any).value = '2';
			(rule as any).movementType = 'walk';
			(rule as any)._source = {};

			// Override the item getter
			Object.defineProperty(rule, 'item', {
				get: () => item,
				configurable: true,
			});

			rule.prePrepareData();

			// Should not modify anything since item is not embedded
			expect(actor.system.attributes.movement.walk).toBe(6);
		});

		it('should handle zero bonus value', () => {
			const actor = createMockActor({ walk: 6, fly: 0, climb: 0, swim: 0, burrow: 0 });
			const rule = createSpeedBonusRule({ value: '0' }, actor);

			rule.prePrepareData();

			expect(actor.system.attributes.movement.walk).toBe(6);
		});

		it('should handle whitespace in numeric values', () => {
			const actor = createMockActor({ walk: 6, fly: 0, climb: 0, swim: 0, burrow: 0 });
			const rule = createSpeedBonusRule({ value: '  2  ' }, actor);

			rule.prePrepareData();

			expect(actor.system.attributes.movement.walk).toBe(8);
		});
	});

	describe('schema', () => {
		it('should define the correct schema fields', () => {
			const schema = SpeedBonusRule.defineSchema();

			expect(schema).toHaveProperty('value');
			expect(schema).toHaveProperty('type');
			expect(schema).toHaveProperty('movementType');
			expect(schema).toHaveProperty('disabled');
			expect(schema).toHaveProperty('label');
		});
	});
});
