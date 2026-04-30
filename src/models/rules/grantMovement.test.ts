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

	describe('prePrepareData', () => {
		it('should grant fly speed equal to walk speed', () => {
			const actor = createMockActor({ walk: 8 });
			const rule = createGrantMovementRule(
				{ mode: 'fly', speed: '@attributes.movement.walk' },
				actor,
			);

			rule.prePrepareData();

			expect(actor.system.attributes.movement.fly).toBe(8);
		});

		it('should grant a fixed speed value', () => {
			const actor = createMockActor();
			const rule = createGrantMovementRule({ mode: 'fly', speed: '12' }, actor);

			rule.prePrepareData();

			expect(actor.system.attributes.movement.fly).toBe(12);
		});

		it('should grant climb speed', () => {
			const actor = createMockActor({ walk: 6 });
			const rule = createGrantMovementRule(
				{ mode: 'climb', speed: '@attributes.movement.walk' },
				actor,
			);

			rule.prePrepareData();

			expect(actor.system.attributes.movement.climb).toBe(6);
		});

		it('should grant swim speed', () => {
			const actor = createMockActor({ walk: 6 });
			const rule = createGrantMovementRule(
				{ mode: 'swim', speed: '@attributes.movement.walk' },
				actor,
			);

			rule.prePrepareData();

			expect(actor.system.attributes.movement.swim).toBe(6);
		});

		it('should grant burrow speed', () => {
			const actor = createMockActor();
			const rule = createGrantMovementRule({ mode: 'burrow', speed: '4' }, actor);

			rule.prePrepareData();

			expect(actor.system.attributes.movement.burrow).toBe(4);
		});

		it('should use Math.max — take highest when multiple grants exist', () => {
			const actor = createMockActor({ walk: 8 });

			// First grant: fly = walk (8)
			const rule1 = createGrantMovementRule(
				{ mode: 'fly', speed: '@attributes.movement.walk' },
				actor,
			);
			rule1.prePrepareData();
			expect(actor.system.attributes.movement.fly).toBe(8);

			// Second grant: fly = 12 (higher)
			const rule2 = createGrantMovementRule({ mode: 'fly', speed: '12' }, actor);
			rule2.prePrepareData();
			expect(actor.system.attributes.movement.fly).toBe(12);
		});

		it('should not reduce existing higher speed', () => {
			const actor = createMockActor({ fly: 12 });

			// Grant fly = 8 (lower than existing 12)
			const rule = createGrantMovementRule({ mode: 'fly', speed: '8' }, actor);
			rule.prePrepareData();

			expect(actor.system.attributes.movement.fly).toBe(12);
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

		it('should not modify movement when speed resolves to 0', () => {
			const actor = createMockActor();
			const rule = createGrantMovementRule({ mode: 'fly', speed: '0' }, actor);

			rule.prePrepareData();

			expect(actor.system.attributes.movement.fly).toBe(0);
		});

		it('should leave walk speed unchanged', () => {
			const actor = createMockActor({ walk: 6 });
			const rule = createGrantMovementRule(
				{ mode: 'fly', speed: '@attributes.movement.walk' },
				actor,
			);

			rule.prePrepareData();

			expect(actor.system.attributes.movement.walk).toBe(6);
			expect(actor.system.attributes.movement.fly).toBe(6);
		});
	});

	describe('interaction with speedBonus', () => {
		it('should allow speedBonus to stack on top of granted base', () => {
			const actor = createMockActor({ walk: 8 });

			// Grant fly = walk (8)
			const grantRule = createGrantMovementRule(
				{ mode: 'fly', speed: '@attributes.movement.walk' },
				actor,
			);
			grantRule.prePrepareData();
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
