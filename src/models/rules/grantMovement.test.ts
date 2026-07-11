import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GrantMovementRule } from './grantMovement.js';

type MovementMode = 'walk' | 'fly' | 'climb' | 'swim' | 'burrow';

interface MockMovement {
	walk: number;
	fly: number;
	climb: number;
	swim: number;
	burrow: number;
	[key: string]: number;
}

interface MockActor {
	system: {
		attributes: {
			movement: MockMovement;
		};
		movementGrants?: Record<string, number>;
	};
	_source: {
		system: {
			attributes: {
				movement: MockMovement;
			};
		};
	};
	getRollData: ReturnType<typeof vi.fn>;
}

interface MockItem {
	isEmbedded: boolean;
	actor: MockActor;
	name: string;
	uuid: string;
}

function createMockActor(
	movement: Partial<MockMovement> = {},
	rollData: Record<string, unknown> = {},
	sourceOverrides: Partial<MockMovement> = {},
): MockActor {
	const mov: MockMovement = {
		walk: 6,
		fly: 0,
		climb: 0,
		swim: 0,
		burrow: 0,
		...movement,
	};
	// Source represents the persisted base values (before any rules run)
	const sourceMov: MockMovement = {
		walk: 6,
		fly: 0,
		climb: 0,
		swim: 0,
		burrow: 0,
		...sourceOverrides,
	};
	return {
		system: {
			attributes: {
				movement: mov,
			},
		},
		_source: {
			system: {
				attributes: {
					movement: sourceMov,
				},
			},
		},
		getRollData: vi.fn(() => ({
			attributes: { movement: mov },
			...rollData,
		})),
	};
}

function createMockItem(actor: MockActor, isEmbedded = true): MockItem {
	return {
		isEmbedded,
		actor,
		name: 'Test Item',
		uuid: 'test-item-uuid',
	};
}

function createGrantMovementRule(
	config: {
		mode?: MovementMode;
		speed?: string;
		disabled?: boolean;
	},
	actor: MockActor,
	itemOptions?: { isEmbedded?: boolean },
): GrantMovementRule {
	const item = createMockItem(actor, itemOptions?.isEmbedded ?? true);

	const sourceData = {
		mode: config.mode ?? 'fly',
		speed: config.speed ?? '@attributes.movement.walk',
		disabled: config.disabled ?? false,
		label: 'Test Rule',
		id: 'test-rule-id',
		identifier: '',
		priority: 1,
		predicate: {},
		type: 'grantMovement',
	};

	const rule = new GrantMovementRule(
		sourceData as foundry.data.fields.SchemaField.CreateData<GrantMovementRule['schema']['fields']>,
		{ parent: item as unknown as foundry.abstract.DataModel.Any, strict: false },
	);

	(rule as any).mode = config.mode ?? 'fly';
	(rule as any).speed = config.speed ?? '@attributes.movement.walk';
	(rule as any).disabled = config.disabled ?? false;

	Object.defineProperty(rule, 'item', {
		get: () => item,
		configurable: true,
	});

	Object.defineProperty(rule, '_predicate', {
		get: () => ({ size: 0 }),
		configurable: true,
	});

	return rule;
}

describe('GrantMovementRule', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('prePrepareData (numeric speeds)', () => {
		it('should grant a fixed fly speed', () => {
			const actor = createMockActor();
			const rule = createGrantMovementRule({ mode: 'fly', speed: '12' }, actor);

			rule.prePrepareData();

			expect(actor.system.attributes.movement.fly).toBe(12);
		});

		it('should grant a fixed burrow speed', () => {
			const actor = createMockActor();
			const rule = createGrantMovementRule({ mode: 'burrow', speed: '4' }, actor);

			rule.prePrepareData();

			expect(actor.system.attributes.movement.burrow).toBe(4);
		});

		it('should use Math.max — take highest when multiple numeric grants exist', () => {
			const actor = createMockActor();

			const rule1 = createGrantMovementRule({ mode: 'fly', speed: '8' }, actor);
			rule1.prePrepareData();
			expect(actor.system.attributes.movement.fly).toBe(8);

			const rule2 = createGrantMovementRule({ mode: 'fly', speed: '12' }, actor);
			rule2.prePrepareData();
			expect(actor.system.attributes.movement.fly).toBe(12);
		});

		it('should not reduce existing higher grant', () => {
			const actor = createMockActor();

			// First grant: fly = 12
			const rule1 = createGrantMovementRule({ mode: 'fly', speed: '12' }, actor);
			rule1.prePrepareData();
			expect(actor.system.attributes.movement.fly).toBe(12);

			// Second grant: fly = 8 (lower — should not reduce)
			const rule2 = createGrantMovementRule({ mode: 'fly', speed: '8' }, actor);
			rule2.prePrepareData();
			expect(actor.system.attributes.movement.fly).toBe(12);
		});

		it('should not process formula values in prePrepareData', () => {
			const actor = createMockActor({ walk: 8 });
			const rule = createGrantMovementRule(
				{ mode: 'fly', speed: '@attributes.movement.walk' },
				actor,
			);

			rule.prePrepareData();

			// Formula values should be skipped in prePrepareData
			expect(actor.system.attributes.movement.fly).toBe(0);
		});

		it('should not modify movement when item is not embedded', () => {
			const actor = createMockActor();
			const rule = createGrantMovementRule({ mode: 'fly', speed: '12' }, actor, {
				isEmbedded: false,
			});

			rule.prePrepareData();

			expect(actor.system.attributes.movement.fly).toBe(0);
		});

		it('should not modify movement when rule is disabled', () => {
			const actor = createMockActor();
			const rule = createGrantMovementRule({ mode: 'fly', speed: '12', disabled: true }, actor);

			rule.prePrepareData();

			expect(actor.system.attributes.movement.fly).toBe(0);
		});

		it('should not modify movement when speed is 0', () => {
			const actor = createMockActor();
			const rule = createGrantMovementRule({ mode: 'fly', speed: '0' }, actor);

			rule.prePrepareData();

			expect(actor.system.attributes.movement.fly).toBe(0);
		});
	});

	describe('afterPrepareData (formula speeds)', () => {
		it('should grant fly speed equal to walk speed', () => {
			const actor = createMockActor({ walk: 8 });
			const rule = createGrantMovementRule(
				{ mode: 'fly', speed: '@attributes.movement.walk' },
				actor,
			);

			rule.afterPrepareData();

			expect(actor.system.attributes.movement.fly).toBe(8);
		});

		it('should grant climb speed equal to walk speed', () => {
			const actor = createMockActor({ walk: 6 });
			const rule = createGrantMovementRule(
				{ mode: 'climb', speed: '@attributes.movement.walk' },
				actor,
			);

			rule.afterPrepareData();

			expect(actor.system.attributes.movement.climb).toBe(6);
		});

		it('should grant swim speed equal to walk speed', () => {
			const actor = createMockActor({ walk: 6 });
			const rule = createGrantMovementRule(
				{ mode: 'swim', speed: '@attributes.movement.walk' },
				actor,
			);

			rule.afterPrepareData();

			expect(actor.system.attributes.movement.swim).toBe(6);
		});

		it('should not process numeric values in afterPrepareData', () => {
			const actor = createMockActor();
			const rule = createGrantMovementRule({ mode: 'fly', speed: '12' }, actor);

			rule.afterPrepareData();

			// Numeric values should be skipped in afterPrepareData (already handled)
			expect(actor.system.attributes.movement.fly).toBe(0);
		});

		it('should leave walk speed unchanged when granting fly = walk', () => {
			const actor = createMockActor({ walk: 6 });
			const rule = createGrantMovementRule(
				{ mode: 'fly', speed: '@attributes.movement.walk' },
				actor,
			);

			rule.afterPrepareData();

			expect(actor.system.attributes.movement.walk).toBe(6);
			expect(actor.system.attributes.movement.fly).toBe(6);
		});

		it('should use Math.max with formula — higher numeric grant wins over lower formula', () => {
			const actor = createMockActor({ walk: 8 });

			// First: numeric grant fly = 12 (in prePrepareData)
			const numericRule = createGrantMovementRule({ mode: 'fly', speed: '12' }, actor);
			numericRule.prePrepareData();
			expect(actor.system.attributes.movement.fly).toBe(12);

			// Second: formula grant fly = walk (8) — lower grant, should not reduce
			const formulaRule = createGrantMovementRule(
				{ mode: 'fly', speed: '@attributes.movement.walk' },
				actor,
			);
			formulaRule.afterPrepareData();
			// Best grant is still 12, walk formula (8) is lower
			expect(actor.system.attributes.movement.fly).toBe(12);
		});

		it('should use Math.max with formula — higher formula grant wins over lower numeric', () => {
			const actor = createMockActor({ walk: 14 });

			// First: numeric grant fly = 6 (in prePrepareData)
			const numericRule = createGrantMovementRule({ mode: 'fly', speed: '6' }, actor);
			numericRule.prePrepareData();
			expect(actor.system.attributes.movement.fly).toBe(6);

			// Second: formula grant fly = walk (14) — higher, should upgrade
			const formulaRule = createGrantMovementRule(
				{ mode: 'fly', speed: '@attributes.movement.walk' },
				actor,
			);
			formulaRule.afterPrepareData();
			expect(actor.system.attributes.movement.fly).toBe(14);
		});
	});

	describe('two-phase processing', () => {
		it('should ensure formula grants see fully modified walk speed', () => {
			const actor = createMockActor({ walk: 6 });

			// Phase 1: a speedBonus would add +2 to walk (simulated)
			actor.system.attributes.movement.walk = 8;
			// Update getRollData to reflect new walk
			actor.getRollData = vi.fn(() => ({
				attributes: { movement: actor.system.attributes.movement },
			}));

			// Phase 2: formula grant reads the modified walk
			const rule = createGrantMovementRule(
				{ mode: 'climb', speed: '@attributes.movement.walk' },
				actor,
			);
			rule.afterPrepareData();

			expect(actor.system.attributes.movement.climb).toBe(8);
		});
	});

	describe('interaction with speedBonus', () => {
		it('should preserve speedBonus applied before formula grant', () => {
			const actor = createMockActor({ walk: 8 });

			// Simulate speedBonus +3 climb running in prePrepareData (before grant)
			actor.system.attributes.movement.climb = 3;

			// Grant climb = walk (8) in afterPrepareData
			const grantRule = createGrantMovementRule(
				{ mode: 'climb', speed: '@attributes.movement.walk' },
				actor,
			);
			grantRule.afterPrepareData();

			// Should be grant (8) + bonus (3) = 11
			expect(actor.system.attributes.movement.climb).toBe(11);
		});

		it('should preserve speedBonus applied before numeric grant', () => {
			const actor = createMockActor();

			// Simulate speedBonus +3 fly running in prePrepareData (before grant)
			actor.system.attributes.movement.fly = 3;

			// Grant fly = 12 in prePrepareData
			const grantRule = createGrantMovementRule({ mode: 'fly', speed: '12' }, actor);
			grantRule.prePrepareData();

			// Should be grant (12) + bonus (3) = 15
			expect(actor.system.attributes.movement.fly).toBe(15);
		});

		it('should stack bonuses on top of the highest grant', () => {
			const actor = createMockActor();

			// Simulate speedBonus +2 fly
			actor.system.attributes.movement.fly = 2;

			// First grant: fly = 6
			const grant1 = createGrantMovementRule({ mode: 'fly', speed: '6' }, actor);
			grant1.prePrepareData();
			// grant(6) + bonus(2) = 8
			expect(actor.system.attributes.movement.fly).toBe(8);

			// Second grant: fly = 12 (higher)
			const grant2 = createGrantMovementRule({ mode: 'fly', speed: '12' }, actor);
			grant2.prePrepareData();
			// grant(12) + bonus(2) = 14
			expect(actor.system.attributes.movement.fly).toBe(14);
		});
	});

	describe('walk mode', () => {
		it('should set walk speed when grant exceeds native walk', () => {
			// Turtlefolk native walk = 5, Boots of Striding grant walk = 6 → becomes 6
			const actor = createMockActor({ walk: 5 }, {}, { walk: 5 });
			const rule = createGrantMovementRule({ mode: 'walk', speed: '6' }, actor);

			rule.prePrepareData();

			expect(actor.system.attributes.movement.walk).toBe(6);
		});

		it('should not reduce walk when grant is lower than native walk', () => {
			// Actor native walk = 8, grant walk = 6 → stays 8
			const actor = createMockActor({ walk: 8 }, {}, { walk: 8 });
			const rule = createGrantMovementRule({ mode: 'walk', speed: '6' }, actor);

			rule.prePrepareData();

			expect(actor.system.attributes.movement.walk).toBe(8);
		});

		it('should preserve speedBonus on top of walk grant', () => {
			// Native walk = 5, speedBonus +2 already applied (live = 7), grant = 6 → 6 + 2 = 8
			const actor = createMockActor({ walk: 7 }, {}, { walk: 5 });
			const rule = createGrantMovementRule({ mode: 'walk', speed: '6' }, actor);

			rule.prePrepareData();

			expect(actor.system.attributes.movement.walk).toBe(8);
		});
	});

	describe('schema', () => {
		it('should define the correct schema fields', () => {
			const schema = GrantMovementRule.defineSchema();

			expect(schema).toHaveProperty('mode');
			expect(schema).toHaveProperty('speed');
			expect(schema).toHaveProperty('type');
			expect(schema).toHaveProperty('disabled');
			expect(schema).toHaveProperty('label');
		});
	});
});
