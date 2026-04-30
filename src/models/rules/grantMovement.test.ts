import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GrantMovementRule } from './grantMovement.js';

type MovementMode = 'fly' | 'climb' | 'swim' | 'burrow';

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
): MockActor {
	const mov: MockMovement = {
		walk: 6,
		fly: 0,
		climb: 0,
		swim: 0,
		burrow: 0,
		...movement,
	};
	return {
		system: {
			attributes: {
				movement: mov,
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

		it('should not reduce existing higher speed', () => {
			const actor = createMockActor({ fly: 12 });

			const rule = createGrantMovementRule({ mode: 'fly', speed: '8' }, actor);
			rule.prePrepareData();

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

		it('should use Math.max with formula — higher grant wins', () => {
			const actor = createMockActor({ walk: 8 });

			// First: numeric grant fly = 12 (in prePrepareData)
			const numericRule = createGrantMovementRule({ mode: 'fly', speed: '12' }, actor);
			numericRule.prePrepareData();
			expect(actor.system.attributes.movement.fly).toBe(12);

			// Second: formula grant fly = walk (8) — lower, should not reduce
			const formulaRule = createGrantMovementRule(
				{ mode: 'fly', speed: '@attributes.movement.walk' },
				actor,
			);
			formulaRule.afterPrepareData();
			expect(actor.system.attributes.movement.fly).toBe(12);
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
		it('should allow speedBonus to stack on top of granted base', () => {
			const actor = createMockActor({ walk: 8 });

			// Grant fly = walk (8) in afterPrepareData
			const grantRule = createGrantMovementRule(
				{ mode: 'fly', speed: '@attributes.movement.walk' },
				actor,
			);
			grantRule.afterPrepareData();
			expect(actor.system.attributes.movement.fly).toBe(8);

			// Simulate speedBonus adding +2 on top
			actor.system.attributes.movement.fly += 2;
			expect(actor.system.attributes.movement.fly).toBe(10);
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
