import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDamageBonusTotal } from '../../utils/attackUtils.js';
import { type DamageBonusEntry, DamageBonusRule, type DamageBonusTarget } from './damageBonus.js';

interface MockActor {
	system: {
		damageBonuses?: DamageBonusEntry[];
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

function createDamageBonusRule(
	config: {
		value?: string;
		damageType?: string;
		appliesTo?: DamageBonusTarget;
		disabled?: boolean;
	},
	actor: MockActor,
	itemOptions?: { isEmbedded?: boolean },
): DamageBonusRule {
	const item = createMockItem(actor, itemOptions?.isEmbedded ?? true);

	const sourceData = {
		value: config.value ?? '@level',
		damageType: config.damageType ?? 'bludgeoning',
		appliesTo: config.appliesTo ?? 'any',
		disabled: config.disabled ?? false,
		label: 'Test Rule',
		id: 'test-rule-id',
		identifier: '',
		priority: 1,
		predicate: {},
		type: 'damageBonus',
	};

	const rule = new DamageBonusRule(
		sourceData as foundry.data.fields.SchemaField.CreateData<DamageBonusRule['schema']['fields']>,
		{ parent: item as unknown as foundry.abstract.DataModel.Any, strict: false },
	);

	// Manually set properties since the mock DataModel doesn't do this automatically
	(rule as any).value = config.value ?? '@level';
	(rule as any).damageType = config.damageType ?? 'bludgeoning';
	(rule as any).appliesTo = config.appliesTo ?? 'any';
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

describe('DamageBonusRule', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('afterPrepareData', () => {
		it('should push a damage bonus entry to the actor', () => {
			const actor = createMockActor({ level: 5 });
			const rule = createDamageBonusRule({ value: '3', appliesTo: 'melee' }, actor);

			rule.afterPrepareData();

			expect(actor.system.damageBonuses).toEqual([
				{ value: 3, damageType: 'bludgeoning', appliesTo: 'melee' },
			]);
		});

		it('should resolve formula values against actor roll data', () => {
			const actor = createMockActor({ level: 10 });
			const rule = createDamageBonusRule({ value: '@level', appliesTo: 'any' }, actor);

			rule.afterPrepareData();

			expect(actor.system.damageBonuses).toEqual([
				{ value: 10, damageType: 'bludgeoning', appliesTo: 'any' },
			]);
		});

		it('should stack multiple bonuses in the array', () => {
			const actor = createMockActor({ level: 5 });

			const rule1 = createDamageBonusRule(
				{ value: '2', appliesTo: 'melee', damageType: 'bludgeoning' },
				actor,
			);
			const rule2 = createDamageBonusRule(
				{ value: '3', appliesTo: 'ranged', damageType: 'fire' },
				actor,
			);

			rule1.afterPrepareData();
			rule2.afterPrepareData();

			expect(actor.system.damageBonuses).toHaveLength(2);
			expect(actor.system.damageBonuses).toEqual([
				{ value: 2, damageType: 'bludgeoning', appliesTo: 'melee' },
				{ value: 3, damageType: 'fire', appliesTo: 'ranged' },
			]);
		});

		it('should preserve the appliesTo value for each bonus', () => {
			const actor = createMockActor({});

			const meleeRule = createDamageBonusRule({ value: '1', appliesTo: 'melee' }, actor);
			const rangedRule = createDamageBonusRule({ value: '2', appliesTo: 'ranged' }, actor);
			const spellRule = createDamageBonusRule({ value: '3', appliesTo: 'spell' }, actor);
			const anyRule = createDamageBonusRule({ value: '4', appliesTo: 'any' }, actor);

			meleeRule.afterPrepareData();
			rangedRule.afterPrepareData();
			spellRule.afterPrepareData();
			anyRule.afterPrepareData();

			expect(actor.system.damageBonuses).toHaveLength(4);
			expect(actor.system.damageBonuses![0].appliesTo).toBe('melee');
			expect(actor.system.damageBonuses![1].appliesTo).toBe('ranged');
			expect(actor.system.damageBonuses![2].appliesTo).toBe('spell');
			expect(actor.system.damageBonuses![3].appliesTo).toBe('any');
		});

		it('should not add a bonus when value resolves to 0', () => {
			const actor = createMockActor({});
			const rule = createDamageBonusRule({ value: '0', appliesTo: 'melee' }, actor);

			rule.afterPrepareData();

			expect(actor.system.damageBonuses).toBeUndefined();
		});

		it('should not add a bonus when item is not embedded', () => {
			const actor = createMockActor({ level: 5 });
			const rule = createDamageBonusRule({ value: '3' }, actor, { isEmbedded: false });

			rule.afterPrepareData();

			expect(actor.system.damageBonuses).toBeUndefined();
		});

		it('should not add a bonus when rule is disabled', () => {
			const actor = createMockActor({ level: 5 });
			const rule = createDamageBonusRule({ value: '3', disabled: true }, actor);

			rule.afterPrepareData();

			expect(actor.system.damageBonuses).toBeUndefined();
		});

		it('should preserve custom damage types', () => {
			const actor = createMockActor({});
			const rule = createDamageBonusRule(
				{ value: '5', damageType: 'necrotic', appliesTo: 'spell' },
				actor,
			);

			rule.afterPrepareData();

			expect(actor.system.damageBonuses).toEqual([
				{ value: 5, damageType: 'necrotic', appliesTo: 'spell' },
			]);
		});
	});

	describe('schema', () => {
		it('should define the correct schema fields', () => {
			const schema = DamageBonusRule.defineSchema();

			expect(schema).toHaveProperty('value');
			expect(schema).toHaveProperty('damageType');
			expect(schema).toHaveProperty('appliesTo');
			expect(schema).toHaveProperty('type');
			expect(schema).toHaveProperty('disabled');
			expect(schema).toHaveProperty('label');
		});
	});
});

describe('getDamageBonusTotal', () => {
	it('should return 0 for null actor', () => {
		expect(getDamageBonusTotal(null, 'melee')).toBe(0);
	});

	it('should return 0 for actor with no bonuses', () => {
		expect(getDamageBonusTotal({ system: {} }, 'melee')).toBe(0);
	});

	it('should return 0 for actor with empty bonuses array', () => {
		expect(getDamageBonusTotal({ system: { damageBonuses: [] } }, 'melee')).toBe(0);
	});

	it('should sum matching melee bonuses', () => {
		const actor = {
			system: {
				damageBonuses: [
					{ value: 3, damageType: 'bludgeoning', appliesTo: 'melee' as const },
					{ value: 2, damageType: 'fire', appliesTo: 'melee' as const },
				],
			},
		};

		expect(getDamageBonusTotal(actor, 'melee')).toBe(5);
	});

	it('should include "any" bonuses regardless of attack type', () => {
		const actor = {
			system: {
				damageBonuses: [
					{ value: 3, damageType: 'bludgeoning', appliesTo: 'melee' as const },
					{ value: 4, damageType: 'fire', appliesTo: 'any' as const },
				],
			},
		};

		expect(getDamageBonusTotal(actor, 'melee')).toBe(7);
		expect(getDamageBonusTotal(actor, 'ranged')).toBe(4);
		expect(getDamageBonusTotal(actor, 'spell')).toBe(4);
	});

	it('should exclude non-matching bonuses', () => {
		const actor = {
			system: {
				damageBonuses: [
					{ value: 3, damageType: 'bludgeoning', appliesTo: 'melee' as const },
					{ value: 5, damageType: 'fire', appliesTo: 'spell' as const },
				],
			},
		};

		expect(getDamageBonusTotal(actor, 'ranged')).toBe(0);
	});

	it('should sum ranged bonuses correctly', () => {
		const actor = {
			system: {
				damageBonuses: [
					{ value: 2, damageType: 'piercing', appliesTo: 'ranged' as const },
					{ value: 1, damageType: 'fire', appliesTo: 'any' as const },
					{ value: 5, damageType: 'bludgeoning', appliesTo: 'melee' as const },
				],
			},
		};

		expect(getDamageBonusTotal(actor, 'ranged')).toBe(3);
	});
});
