import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DyingActionLimitRule } from './dyingActionLimit.js';

interface MockActor {
	system: {
		attributes: { dyingActionLimit?: number };
	};
	getRollData: ReturnType<typeof vi.fn>;
	getDomain: ReturnType<typeof vi.fn>;
}

interface MockItem {
	isEmbedded: boolean;
	actor: MockActor;
	name: string;
	uuid: string;
	getDomain: ReturnType<typeof vi.fn>;
}

function createMockActor(dyingActionLimit = 1): MockActor {
	return {
		system: { attributes: { dyingActionLimit } },
		getRollData: vi.fn(() => ({})),
		getDomain: vi.fn(() => new Set<string>()),
	};
}

function createDyingActionLimitRule(
	config: {
		value?: string;
		disabled?: boolean;
		predicatePasses?: boolean;
	},
	actor: MockActor,
	itemOptions?: { isEmbedded?: boolean },
): DyingActionLimitRule {
	const item: MockItem = {
		isEmbedded: itemOptions?.isEmbedded ?? true,
		actor,
		name: 'Test Item',
		uuid: 'test-item-uuid',
		getDomain: vi.fn(() => new Set<string>()),
	};

	const sourceData = {
		value: config.value ?? '2',
		disabled: config.disabled ?? false,
		label: 'Test Rule',
		id: 'test-rule-id',
		identifier: '',
		priority: 1,
		predicate: {},
		type: 'dyingActionLimit',
	};

	const rule = new DyingActionLimitRule(
		sourceData as foundry.data.fields.SchemaField.CreateData<
			DyingActionLimitRule['schema']['fields']
		>,
		{ parent: item as unknown as foundry.abstract.DataModel.Any, strict: false },
	);

	(rule as any).value = config.value ?? '2';
	(rule as any).disabled = config.disabled ?? false;

	Object.defineProperty(rule, 'item', {
		get: () => item,
		configurable: true,
	});

	const predicatePasses = config.predicatePasses ?? true;
	Object.defineProperty(rule, '_predicate', {
		get: () => ({ size: predicatePasses ? 0 : 1, test: () => predicatePasses }),
		configurable: true,
	});

	return rule;
}

describe('DyingActionLimitRule', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('afterPrepareData', () => {
		it('raises the dying action limit when the predicate passes', () => {
			const actor = createMockActor(1);
			const rule = createDyingActionLimitRule({ value: '2' }, actor);

			rule.afterPrepareData();

			expect(actor.system.attributes.dyingActionLimit).toBe(2);
		});

		it('keeps the highest limit when stacking features (never lowers it)', () => {
			const actor = createMockActor(3);
			const rule = createDyingActionLimitRule({ value: '2' }, actor);

			rule.afterPrepareData();

			expect(actor.system.attributes.dyingActionLimit).toBe(3);
		});

		it('does not change the limit when the predicate fails', () => {
			const actor = createMockActor(1);
			const rule = createDyingActionLimitRule({ value: '2', predicatePasses: false }, actor);

			rule.afterPrepareData();

			expect(actor.system.attributes.dyingActionLimit).toBe(1);
		});

		it('does nothing when the rule is disabled', () => {
			const actor = createMockActor(1);
			const rule = createDyingActionLimitRule({ value: '2', disabled: true }, actor);

			rule.afterPrepareData();

			expect(actor.system.attributes.dyingActionLimit).toBe(1);
		});

		it('does nothing when the item is not embedded', () => {
			const actor = createMockActor(1);
			const rule = createDyingActionLimitRule({ value: '2' }, actor, { isEmbedded: false });

			rule.afterPrepareData();

			expect(actor.system.attributes.dyingActionLimit).toBe(1);
		});
	});

	describe('schema', () => {
		it('defines the expected fields', () => {
			const schema = DyingActionLimitRule.defineSchema();
			expect(schema).toHaveProperty('type');
			expect(schema).toHaveProperty('value');
		});
	});

	describe('class metadata', () => {
		it('exposes the picker group and i18n description key', () => {
			expect(DyingActionLimitRule.group).toBe('bonuses');
			expect(DyingActionLimitRule.description).toBe('NIMBLE.rules.dyingActionLimit.description');
		});
	});
});
