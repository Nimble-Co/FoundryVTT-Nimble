import { beforeEach, describe, expect, it, vi } from 'vitest';
import { conditionImmunityGuard, isConditionImmune } from '../../hooks/conditionImmunityGuard.js';
import { ConditionImmunityRule } from './conditionImmunity.js';

interface MockActor {
	system: {
		conditionImmunities?: Set<string>;
	};
	getRollData: ReturnType<typeof vi.fn>;
}

interface MockItem {
	isEmbedded: boolean;
	actor: MockActor;
	name: string;
	uuid: string;
}

function createMockActor(): MockActor {
	return {
		system: {},
		getRollData: vi.fn(() => ({})),
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

function createConditionImmunityRule(
	config: {
		conditions?: string[];
		disabled?: boolean;
	},
	actor: MockActor,
	itemOptions?: { isEmbedded?: boolean },
): ConditionImmunityRule {
	const item = createMockItem(actor, itemOptions?.isEmbedded ?? true);

	const sourceData = {
		conditions: config.conditions ?? ['frightened'],
		disabled: config.disabled ?? false,
		label: 'Test Rule',
		id: 'test-rule-id',
		identifier: '',
		priority: 1,
		predicate: {},
		type: 'conditionImmunity',
	};

	const rule = new ConditionImmunityRule(
		sourceData as foundry.data.fields.SchemaField.CreateData<
			ConditionImmunityRule['schema']['fields']
		>,
		{ parent: item as unknown as foundry.abstract.DataModel.Any, strict: false },
	);

	(rule as any).conditions = config.conditions ?? ['frightened'];
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

describe('ConditionImmunityRule', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('afterPrepareData', () => {
		it('should add condition to the actor conditionImmunities set', () => {
			const actor = createMockActor();
			const rule = createConditionImmunityRule({ conditions: ['frightened'] }, actor);

			rule.afterPrepareData();

			expect(actor.system.conditionImmunities).toBeInstanceOf(Set);
			expect(actor.system.conditionImmunities!.has('frightened')).toBe(true);
		});

		it('should add multiple conditions from a single rule', () => {
			const actor = createMockActor();
			const rule = createConditionImmunityRule({ conditions: ['frightened', 'charmed'] }, actor);

			rule.afterPrepareData();

			expect(actor.system.conditionImmunities!.has('frightened')).toBe(true);
			expect(actor.system.conditionImmunities!.has('charmed')).toBe(true);
			expect(actor.system.conditionImmunities!.size).toBe(2);
		});

		it('should stack immunities from multiple rules', () => {
			const actor = createMockActor();
			const rule1 = createConditionImmunityRule({ conditions: ['frightened'] }, actor);
			const rule2 = createConditionImmunityRule({ conditions: ['stunned'] }, actor);

			rule1.afterPrepareData();
			rule2.afterPrepareData();

			expect(actor.system.conditionImmunities!.has('frightened')).toBe(true);
			expect(actor.system.conditionImmunities!.has('stunned')).toBe(true);
			expect(actor.system.conditionImmunities!.size).toBe(2);
		});

		it('should handle duplicate conditions gracefully', () => {
			const actor = createMockActor();
			const rule1 = createConditionImmunityRule({ conditions: ['frightened'] }, actor);
			const rule2 = createConditionImmunityRule({ conditions: ['frightened'] }, actor);

			rule1.afterPrepareData();
			rule2.afterPrepareData();

			expect(actor.system.conditionImmunities!.size).toBe(1);
		});

		it('should not modify actor when item is not embedded', () => {
			const actor = createMockActor();
			const rule = createConditionImmunityRule({ conditions: ['frightened'] }, actor, {
				isEmbedded: false,
			});

			rule.afterPrepareData();

			expect(actor.system.conditionImmunities).toBeUndefined();
		});

		it('should not modify actor when rule is disabled', () => {
			const actor = createMockActor();
			const rule = createConditionImmunityRule(
				{ conditions: ['frightened'], disabled: true },
				actor,
			);

			rule.afterPrepareData();

			expect(actor.system.conditionImmunities).toBeUndefined();
		});

		it('should not modify actor when conditions array is empty', () => {
			const actor = createMockActor();
			const rule = createConditionImmunityRule({ conditions: [] }, actor);

			rule.afterPrepareData();

			expect(actor.system.conditionImmunities).toBeUndefined();
		});
	});

	describe('schema', () => {
		it('should define the correct schema fields', () => {
			const schema = ConditionImmunityRule.defineSchema();

			expect(schema).toHaveProperty('conditions');
			expect(schema).toHaveProperty('type');
			expect(schema).toHaveProperty('disabled');
			expect(schema).toHaveProperty('label');
		});
	});
});

describe('conditionImmunityGuard', () => {
	it('should return false for immune conditions', () => {
		const target = { system: { conditionImmunities: new Set(['frightened']) } };
		const result = conditionImmunityGuard({ target, condition: 'frightened' });
		expect(result).toBe(false);
	});

	it('should return undefined for non-immune conditions', () => {
		const target = { system: { conditionImmunities: new Set(['frightened']) } };
		const result = conditionImmunityGuard({ target, condition: 'stunned' });
		expect(result).toBeUndefined();
	});

	it('should return undefined when actor has no immunities', () => {
		const target = { system: {} };
		const result = conditionImmunityGuard({ target, condition: 'frightened' });
		expect(result).toBeUndefined();
	});
});

describe('isConditionImmune', () => {
	it('should return true for immune conditions', () => {
		const actor = { system: { conditionImmunities: new Set(['frightened']) } };
		expect(isConditionImmune(actor, 'frightened')).toBe(true);
	});

	it('should return false for non-immune conditions', () => {
		const actor = { system: { conditionImmunities: new Set(['frightened']) } };
		expect(isConditionImmune(actor, 'stunned')).toBe(false);
	});

	it('should return false for null actor', () => {
		expect(isConditionImmune(null, 'frightened')).toBe(false);
	});

	it('should return false when actor has no immunities', () => {
		const actor = { system: {} };
		expect(isConditionImmune(actor, 'frightened')).toBe(false);
	});
});
