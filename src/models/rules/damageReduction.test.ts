import { beforeEach, describe, expect, it, vi } from 'vitest';
import { actorAccumulatorPaths } from './accumulatorRegistry.js';
import { type DamageReductionEntry, DamageReductionRule } from './damageReduction.js';

interface MockActor {
	system: {
		damageReductions?: DamageReductionEntry[];
	};
	getRollData: ReturnType<typeof vi.fn>;
}

interface MockItem {
	isEmbedded: boolean;
	actor: MockActor;
	name: string;
	uuid: string;
}

function createMockActor(rollData: Record<string, unknown> = {}): MockActor {
	return {
		system: {},
		getRollData: vi.fn(() => rollData),
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

function createDamageReductionRule(
	config: {
		value?: string;
		damageTypes?: string[];
		disabled?: boolean;
		mode?: 'flat' | 'half';
	},
	actor: MockActor,
	itemOptions?: { isEmbedded?: boolean },
): DamageReductionRule {
	const item = createMockItem(actor, itemOptions?.isEmbedded ?? true);

	const sourceData = {
		mode: config.mode ?? 'flat',
		value: config.value ?? '1',
		damageTypes: config.damageTypes ?? [],
		disabled: config.disabled ?? false,
		label: 'Test Rule',
		id: 'test-rule-id',
		identifier: '',
		priority: 1,
		predicate: {},
		type: 'damageReduction',
	};

	const rule = new DamageReductionRule(
		sourceData as foundry.data.fields.SchemaField.CreateData<
			DamageReductionRule['schema']['fields']
		>,
		{ parent: item as unknown as foundry.abstract.DataModel.Any, strict: false },
	);

	(rule as any).mode = config.mode ?? 'flat';
	(rule as any).value = config.value ?? '1';
	(rule as any).damageTypes = config.damageTypes ?? [];
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

describe('DamageReductionRule', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('afterPrepareData', () => {
		it('should push a damage reduction entry to the actor', () => {
			const actor = createMockActor();
			const rule = createDamageReductionRule({ value: '3' }, actor);

			rule.afterPrepareData();

			expect(actor.system.damageReductions).toEqual([
				{ value: 3, damageTypes: [], label: 'Test Item' },
			]);
		});

		it('registers the accumulator path so the actor can reset it each prepare cycle', () => {
			const actor = createMockActor();
			const rule = createDamageReductionRule({ value: '3' }, actor);

			rule.afterPrepareData();

			expect(actorAccumulatorPaths.has('damageReductions')).toBe(true);
		});

		it('should resolve formula values against actor roll data', () => {
			const actor = createMockActor({ level: 10 });
			const rule = createDamageReductionRule({ value: '@level' }, actor);

			rule.afterPrepareData();

			expect(actor.system.damageReductions).toEqual([
				{ value: 10, damageTypes: [], label: 'Test Item' },
			]);
		});

		it('should stack multiple reductions in the array', () => {
			const actor = createMockActor({ level: 5 });

			const rule1 = createDamageReductionRule({ value: '2' }, actor);
			const rule2 = createDamageReductionRule({ value: '@level', damageTypes: ['fire'] }, actor);

			rule1.afterPrepareData();
			rule2.afterPrepareData();

			expect(actor.system.damageReductions).toEqual([
				{ value: 2, damageTypes: [], label: 'Test Item' },
				{ value: 5, damageTypes: ['fire'], label: 'Test Item' },
			]);
		});

		it('should preserve the configured damage types on the entry', () => {
			const actor = createMockActor();
			const rule = createDamageReductionRule({ value: '4', damageTypes: ['fire', 'cold'] }, actor);

			rule.afterPrepareData();

			expect(actor.system.damageReductions).toEqual([
				{ value: 4, damageTypes: ['fire', 'cold'], label: 'Test Item' },
			]);
		});

		it('should copy the damageTypes array rather than sharing the rule field', () => {
			const actor = createMockActor();
			const rule = createDamageReductionRule({ value: '4', damageTypes: ['fire'] }, actor);

			rule.afterPrepareData();

			expect(actor.system.damageReductions![0]!.damageTypes).not.toBe((rule as any).damageTypes);
		});

		it('should not add a reduction when value resolves to 0', () => {
			const actor = createMockActor();
			const rule = createDamageReductionRule({ value: '0' }, actor);

			rule.afterPrepareData();

			expect(actor.system.damageReductions).toBeUndefined();
		});

		it('should not add a reduction when value resolves to a negative number', () => {
			const actor = createMockActor();
			const rule = createDamageReductionRule({ value: '-2' }, actor);

			rule.afterPrepareData();

			expect(actor.system.damageReductions).toBeUndefined();
		});

		it('should not add a reduction when item is not embedded', () => {
			const actor = createMockActor({ level: 5 });
			const rule = createDamageReductionRule({ value: '3' }, actor, { isEmbedded: false });

			rule.afterPrepareData();

			expect(actor.system.damageReductions).toBeUndefined();
		});

		it('should not add a reduction when rule is disabled', () => {
			const actor = createMockActor({ level: 5 });
			const rule = createDamageReductionRule({ value: '3', disabled: true }, actor);

			rule.afterPrepareData();

			expect(actor.system.damageReductions).toBeUndefined();
		});

		it('should skip dice-expression values and warn', () => {
			const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
			const actor = createMockActor();
			const rule = createDamageReductionRule({ value: '1d6' }, actor);

			rule.afterPrepareData();

			expect(actor.system.damageReductions).toBeUndefined();
			expect(warn).toHaveBeenCalledOnce();
			warn.mockRestore();
		});
	});

	describe('schema', () => {
		it('should define the correct schema fields', () => {
			const schema = DamageReductionRule.defineSchema();

			expect(schema).toHaveProperty('value');
			expect(schema).toHaveProperty('damageTypes');
			expect(schema).toHaveProperty('type');
			expect(schema).toHaveProperty('disabled');
			expect(schema).toHaveProperty('label');
			expect(schema).toHaveProperty('predicate');
		});

		it('declares choices on the damageTypes element field', () => {
			const schema = DamageReductionRule.defineSchema();
			const damageTypes = schema.damageTypes as unknown as {
				element: { choices: () => string[] };
			};

			expect(typeof damageTypes.element.choices).toBe('function');
		});
	});

	describe('class metadata', () => {
		it('exposes the picker group and i18n description key', () => {
			expect(DamageReductionRule.group).toBe('bonuses');
			expect(DamageReductionRule.description).toBe('NIMBLE.rules.damageReduction.description');
		});
	});

	describe('half mode', () => {
		it('defaults mode to flat with flat/half choices', () => {
			const schema = DamageReductionRule.defineSchema();
			const mode = schema.mode as unknown as { initial: unknown; choices: string[] };

			expect(mode.initial).toBe('flat');
			expect(mode.choices).toEqual(['flat', 'half']);
		});

		it('pushes a half entry without resolving the value formula', () => {
			const actor = createMockActor();
			const rule = createDamageReductionRule(
				{ mode: 'half', value: '1d6', damageTypes: ['fire'] },
				actor,
			);

			rule.afterPrepareData();

			expect(actor.system.damageReductions).toEqual([
				{ value: 0, damageTypes: ['fire'], mode: 'half', label: 'Test Item' },
			]);
			expect(actor.getRollData).not.toHaveBeenCalled();
		});

		it('does not push a half entry when the predicate fails', () => {
			const actor = createMockActor();
			const rule = createDamageReductionRule({ mode: 'half', disabled: true }, actor);

			rule.afterPrepareData();

			expect(actor.system.damageReductions).toBeUndefined();
		});
	});
});
