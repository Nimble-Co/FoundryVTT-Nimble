import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SpeedBonusRule } from './speedBonus.js';

type MovementType = 'walk' | 'fly' | 'climb' | 'swim' | 'burrow';

interface MockMovement {
	walk?: number;
	fly?: number;
	climb?: number;
	swim?: number;
	burrow?: number;
	[key: string]: number | undefined;
}

interface MockRollData {
	attributes: {
		movement: MockMovement;
	};
	level?: number;
	[key: string]: unknown;
}

interface MockActor {
	system: {
		attributes: {
			movement: MockMovement;
		};
	};
	getRollData: Mock<() => MockRollData>;
	getDomain: Mock<() => Set<string>>;
}

interface MockItem {
	isEmbedded: boolean;
	actor: MockActor;
	name: string;
	uuid: string;
	getDomain: Mock<() => Set<string>>;
}

interface SpeedBonusSourceData {
	value: string;
	movementType?: MovementType;
	disabled: boolean;
	label: string;
	id: string;
	identifier: string;
	priority: number;
	predicate: Record<string, unknown>;
	type: string;
}

// Type for test instances where we need to access/modify internal properties
interface SpeedBonusRuleTestInstance extends SpeedBonusRule {
	value: string;
	movementType: MovementType | null;
	disabled: boolean;
	label: string;
}

/**
 * Creates a mock actor with movement attributes
 */
function createMockActor(
	movement: MockMovement = { walk: 6, fly: 0, climb: 0, swim: 0, burrow: 0 },
): MockActor {
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
		getDomain: vi.fn(() => new Set<string>()),
	};
}

/**
 * Creates a mock item that contains the rule
 */
function createMockItem(actor: MockActor, isEmbedded = true): MockItem {
	return {
		isEmbedded,
		actor,
		name: 'Test Item',
		uuid: 'test-item-uuid',
		getDomain: vi.fn(() => new Set<string>()),
	};
}

/**
 * Creates a SpeedBonusRule instance with the given configuration
 */
function createSpeedBonusRule(
	config: {
		value: string;
		movementType?: MovementType;
		disabled?: boolean;
		label?: string;
		predicatePasses?: boolean;
	},
	actor: MockActor,
	itemOptions?: { isEmbedded?: boolean },
): SpeedBonusRuleTestInstance {
	const item = createMockItem(actor, itemOptions?.isEmbedded ?? true);

	const sourceData: SpeedBonusSourceData = {
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
	const rule = new SpeedBonusRule(
		sourceData as foundry.data.fields.SchemaField.CreateData<SpeedBonusRule['schema']['fields']>,
		{ parent: item as unknown as foundry.abstract.DataModel.Any, strict: false },
	) as SpeedBonusRuleTestInstance;

	// Manually set properties since the mock DataModel doesn't do this automatically
	rule.value = config.value;
	// Null `movementType` is the schema initial — represents a generic walk bonus.
	rule.movementType = config.movementType ?? null;
	rule.disabled = config.disabled ?? false;
	rule.label = config.label ?? 'Test Rule';

	// Override the item getter to return our mock
	Object.defineProperty(rule, 'item', {
		get: () => item,
		configurable: true,
	});

	// Mock the predicate property: size 0 always passes; a non-empty stub
	// exercises the predicate-gated path
	const predicatePasses = config.predicatePasses ?? true;
	Object.defineProperty(rule, 'predicate', {
		get: () => ({ size: predicatePasses ? 0 : 1, test: () => predicatePasses }),
		configurable: true,
	});

	return rule;
}

describe('SpeedBonusRule', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('predicate gating', () => {
		it('should apply a numeric bonus when the predicate passes', () => {
			const actor = createMockActor({ walk: 6, fly: 0, climb: 0, swim: 0, burrow: 0 });
			const rule = createSpeedBonusRule({ value: '2', predicatePasses: true }, actor);

			rule.prePrepareData();

			expect(actor.system.attributes.movement.walk).toBe(8);
		});

		it('should not apply a numeric bonus when the predicate fails', () => {
			const actor = createMockActor({ walk: 6, fly: 0, climb: 0, swim: 0, burrow: 0 });
			const rule = createSpeedBonusRule({ value: '2', predicatePasses: false }, actor);

			rule.prePrepareData();

			expect(actor.system.attributes.movement.walk).toBe(6);
		});

		it('should not apply a formula bonus when the predicate fails', () => {
			const actor = createMockActor({ walk: 6, fly: 0, climb: 0, swim: 0, burrow: 0 });
			const rule = createSpeedBonusRule({ value: '@level', predicatePasses: false }, actor);

			rule.afterPrepareData();

			expect(actor.system.attributes.movement.walk).toBe(6);
		});
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
			const actor = createMockActor({});
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
				attributes: {
					movement: actor.system.attributes.movement,
				},
				level: 5,
			}));
			// Generic formula bonus (no explicit movementType — falls through to walk)
			const rule = createSpeedBonusRule({ value: '@level' }, actor);

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
			const rule = createSpeedBonusRule({ value: '2' }, actor, { isEmbedded: false });

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

		it('declares closed movementType choice set', () => {
			const schema = SpeedBonusRule.defineSchema();
			const movementType = schema.movementType as unknown as { choices: string[] };
			expect(movementType.choices).toEqual(['walk', 'fly', 'climb', 'swim', 'burrow']);
		});
	});

	describe('class metadata', () => {
		it('exposes the picker group and i18n description key', () => {
			expect(SpeedBonusRule.group).toBe('bonuses');
			expect(SpeedBonusRule.description).toBe('NIMBLE.rules.speedBonus.description');
		});
	});
});
