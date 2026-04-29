import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDamageBonusTotal } from '../../utils/attackUtils.js';
import {
	type DamageBonusDelivery,
	type DamageBonusEntry,
	DamageBonusRule,
	type DamageBonusSource,
} from './damageBonus.js';

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
		delivery?: DamageBonusDelivery;
		source?: DamageBonusSource;
		disabled?: boolean;
	},
	actor: MockActor,
	itemOptions?: { isEmbedded?: boolean },
): DamageBonusRule {
	const item = createMockItem(actor, itemOptions?.isEmbedded ?? true);

	const sourceData = {
		value: config.value ?? '@level',
		damageType: config.damageType ?? '',
		delivery: config.delivery ?? 'any',
		source: config.source ?? 'any',
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

	(rule as any).value = config.value ?? '@level';
	(rule as any).damageType = config.damageType ?? '';
	(rule as any).delivery = config.delivery ?? 'any';
	(rule as any).source = config.source ?? 'any';
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
			const rule = createDamageBonusRule(
				{ value: '3', delivery: 'melee', source: 'weapon' },
				actor,
			);

			rule.afterPrepareData();

			expect(actor.system.damageBonuses).toEqual([
				{ value: 3, damageType: '', delivery: 'melee', source: 'weapon' },
			]);
		});

		it('should resolve formula values against actor roll data', () => {
			const actor = createMockActor({ level: 10 });
			const rule = createDamageBonusRule(
				{ value: '@level', delivery: 'any', source: 'any' },
				actor,
			);

			rule.afterPrepareData();

			expect(actor.system.damageBonuses).toEqual([
				{ value: 10, damageType: '', delivery: 'any', source: 'any' },
			]);
		});

		it('should stack multiple bonuses in the array', () => {
			const actor = createMockActor({ level: 5 });

			const rule1 = createDamageBonusRule(
				{ value: '2', delivery: 'melee', source: 'weapon', damageType: 'bludgeoning' },
				actor,
			);
			const rule2 = createDamageBonusRule(
				{ value: '3', delivery: 'any', source: 'spell', damageType: 'fire' },
				actor,
			);

			rule1.afterPrepareData();
			rule2.afterPrepareData();

			expect(actor.system.damageBonuses).toHaveLength(2);
			expect(actor.system.damageBonuses![0]).toMatchObject({
				delivery: 'melee',
				source: 'weapon',
			});
			expect(actor.system.damageBonuses![1]).toMatchObject({
				delivery: 'any',
				source: 'spell',
			});
		});

		it('should preserve delivery and source for each bonus', () => {
			const actor = createMockActor({});

			const meleeWeapon = createDamageBonusRule(
				{ value: '1', delivery: 'melee', source: 'weapon' },
				actor,
			);
			const rangedWeapon = createDamageBonusRule(
				{ value: '2', delivery: 'ranged', source: 'weapon' },
				actor,
			);
			const anySpell = createDamageBonusRule(
				{ value: '3', delivery: 'any', source: 'spell' },
				actor,
			);
			const anyAny = createDamageBonusRule({ value: '4', delivery: 'any', source: 'any' }, actor);

			meleeWeapon.afterPrepareData();
			rangedWeapon.afterPrepareData();
			anySpell.afterPrepareData();
			anyAny.afterPrepareData();

			expect(actor.system.damageBonuses).toHaveLength(4);
			expect(actor.system.damageBonuses![0]).toMatchObject({
				delivery: 'melee',
				source: 'weapon',
			});
			expect(actor.system.damageBonuses![1]).toMatchObject({
				delivery: 'ranged',
				source: 'weapon',
			});
			expect(actor.system.damageBonuses![2]).toMatchObject({
				delivery: 'any',
				source: 'spell',
			});
			expect(actor.system.damageBonuses![3]).toMatchObject({
				delivery: 'any',
				source: 'any',
			});
		});

		it('should not add a bonus when value resolves to 0', () => {
			const actor = createMockActor({});
			const rule = createDamageBonusRule(
				{ value: '0', delivery: 'melee', source: 'weapon' },
				actor,
			);

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
				{ value: '5', damageType: 'necrotic', delivery: 'any', source: 'spell' },
				actor,
			);

			rule.afterPrepareData();

			expect(actor.system.damageBonuses).toEqual([
				{ value: 5, damageType: 'necrotic', delivery: 'any', source: 'spell' },
			]);
		});
	});

	describe('schema', () => {
		it('should define the correct schema fields', () => {
			const schema = DamageBonusRule.defineSchema();

			expect(schema).toHaveProperty('value');
			expect(schema).toHaveProperty('damageType');
			expect(schema).toHaveProperty('delivery');
			expect(schema).toHaveProperty('source');
			expect(schema).toHaveProperty('type');
			expect(schema).toHaveProperty('disabled');
			expect(schema).toHaveProperty('label');
		});
	});
});

describe('getDamageBonusTotal', () => {
	it('should return 0 for null actor', () => {
		expect(getDamageBonusTotal(null, 'melee', 'weapon')).toBe(0);
	});

	it('should return 0 for actor with no bonuses', () => {
		expect(getDamageBonusTotal({ system: {} }, 'melee', 'weapon')).toBe(0);
	});

	it('should return 0 for actor with empty bonuses array', () => {
		expect(getDamageBonusTotal({ system: { damageBonuses: [] } }, 'melee', 'weapon')).toBe(0);
	});

	it('should sum matching melee weapon bonuses', () => {
		const actor = {
			system: {
				damageBonuses: [
					{ value: 3, damageType: '', delivery: 'melee' as const, source: 'weapon' as const },
					{ value: 2, damageType: '', delivery: 'melee' as const, source: 'weapon' as const },
				],
			},
		};

		expect(getDamageBonusTotal(actor, 'melee', 'weapon')).toBe(5);
	});

	it('should include "any" delivery bonuses', () => {
		const actor = {
			system: {
				damageBonuses: [
					{ value: 3, damageType: '', delivery: 'melee' as const, source: 'weapon' as const },
					{ value: 4, damageType: '', delivery: 'any' as const, source: 'any' as const },
				],
			},
		};

		expect(getDamageBonusTotal(actor, 'melee', 'weapon')).toBe(7);
		expect(getDamageBonusTotal(actor, 'ranged', 'weapon')).toBe(4);
		expect(getDamageBonusTotal(actor, 'ranged', 'spell')).toBe(4);
	});

	it('should exclude non-matching delivery', () => {
		const actor = {
			system: {
				damageBonuses: [
					{ value: 3, damageType: '', delivery: 'melee' as const, source: 'weapon' as const },
				],
			},
		};

		expect(getDamageBonusTotal(actor, 'ranged', 'weapon')).toBe(0);
	});

	it('should exclude non-matching source', () => {
		const actor = {
			system: {
				damageBonuses: [
					{ value: 5, damageType: '', delivery: 'any' as const, source: 'spell' as const },
				],
			},
		};

		expect(getDamageBonusTotal(actor, 'melee', 'weapon')).toBe(0);
		expect(getDamageBonusTotal(actor, 'melee', 'spell')).toBe(5);
	});

	it('should filter by damageType when provided', () => {
		const actor = {
			system: {
				damageBonuses: [
					{
						value: 3,
						damageType: 'lightning',
						delivery: 'any' as const,
						source: 'spell' as const,
					},
					{ value: 2, damageType: 'fire', delivery: 'any' as const, source: 'spell' as const },
					{ value: 1, damageType: '', delivery: 'any' as const, source: 'spell' as const },
				],
			},
		};

		// lightning filter: 3 (lightning match) + 1 (empty = any type)
		expect(getDamageBonusTotal(actor, 'ranged', 'spell', 'lightning')).toBe(4);
		// fire filter: 2 (fire match) + 1 (empty = any type)
		expect(getDamageBonusTotal(actor, 'ranged', 'spell', 'fire')).toBe(3);
		// no type filter: all match
		expect(getDamageBonusTotal(actor, 'ranged', 'spell')).toBe(6);
	});

	describe('real-world feature scenarios', () => {
		it('Reverberating Strikes: +LVL bludgeoning to melee weapon attacks', () => {
			const actor = {
				system: {
					damageBonuses: [
						{
							value: 5,
							damageType: 'bludgeoning',
							delivery: 'melee' as const,
							source: 'weapon' as const,
						},
					],
				},
			};

			expect(getDamageBonusTotal(actor, 'melee', 'weapon')).toBe(5);
			expect(getDamageBonusTotal(actor, 'melee', 'spell')).toBe(0);
			expect(getDamageBonusTotal(actor, 'ranged', 'weapon')).toBe(0);
		});

		it('Keen Eye, Steady Hand: +WIL to ranged weapon damage', () => {
			const actor = {
				system: {
					damageBonuses: [
						{
							value: 3,
							damageType: '',
							delivery: 'ranged' as const,
							source: 'weapon' as const,
						},
					],
				},
			};

			expect(getDamageBonusTotal(actor, 'ranged', 'weapon')).toBe(3);
			expect(getDamageBonusTotal(actor, 'ranged', 'spell')).toBe(0);
			expect(getDamageBonusTotal(actor, 'melee', 'weapon')).toBe(0);
		});

		it('Storm Caster: +INT to lightning spell damage', () => {
			const actor = {
				system: {
					damageBonuses: [
						{
							value: 4,
							damageType: 'lightning',
							delivery: 'any' as const,
							source: 'spell' as const,
						},
					],
				},
			};

			expect(getDamageBonusTotal(actor, 'ranged', 'spell', 'lightning')).toBe(4);
			expect(getDamageBonusTotal(actor, 'melee', 'spell', 'lightning')).toBe(4);
			expect(getDamageBonusTotal(actor, 'ranged', 'spell', 'fire')).toBe(0);
			expect(getDamageBonusTotal(actor, 'melee', 'weapon', 'lightning')).toBe(0);
		});

		it('Cycle Eternal (Solar): +KEY to all spell damage', () => {
			const actor = {
				system: {
					damageBonuses: [
						{
							value: 3,
							damageType: '',
							delivery: 'any' as const,
							source: 'spell' as const,
						},
					],
				},
			};

			expect(getDamageBonusTotal(actor, 'ranged', 'spell')).toBe(3);
			expect(getDamageBonusTotal(actor, 'melee', 'spell')).toBe(3);
			expect(getDamageBonusTotal(actor, 'melee', 'weapon')).toBe(0);
		});
	});
});
