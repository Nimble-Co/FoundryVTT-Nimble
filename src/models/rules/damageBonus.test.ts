import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDamageBonusFormulas, getDamageBonusTotal } from '../../utils/attackUtils.js';
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

	Object.defineProperty(rule, '_targetCondition', {
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
				{
					value: 3,
					formula: null,
					damageType: '',
					delivery: 'melee',
					source: 'weapon',
					targetCondition: null,
				},
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
				{
					value: 10,
					formula: null,
					damageType: '',
					delivery: 'any',
					source: 'any',
					targetCondition: null,
				},
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
				{
					value: 5,
					formula: null,
					damageType: 'necrotic',
					delivery: 'any',
					source: 'spell',
					targetCondition: null,
				},
			]);
		});
	});

	describe('targetCondition integration', () => {
		it('should handle a rule without explicit targetCondition in source data', () => {
			const actor = createMockActor({ level: 5 });
			const item = createMockItem(actor);

			// No targetCondition key — ObjectField initializes to {} which
			// PredicateField converts to an empty Predicate (size: 0).
			// The getter guard (tc && tc.size > 0) also handles the truly
			// undefined case defensively, though that path is unreachable
			// through normal schema initialization.
			const sourceData = {
				value: '3',
				damageType: '',
				delivery: 'melee',
				source: 'weapon',
				disabled: false,
				label: 'Legacy Rule',
				id: 'legacy-rule-id',
				identifier: '',
				priority: 1,
				predicate: {},
				type: 'damageBonus',
			};

			const rule = new DamageBonusRule(
				sourceData as foundry.data.fields.SchemaField.CreateData<
					DamageBonusRule['schema']['fields']
				>,
				{ parent: item as unknown as foundry.abstract.DataModel.Any, strict: false },
			);

			(rule as any).value = '3';
			(rule as any).damageType = '';
			(rule as any).delivery = 'melee';
			(rule as any).source = 'weapon';
			(rule as any).disabled = false;

			Object.defineProperty(rule, 'item', {
				get: () => item,
				configurable: true,
			});

			Object.defineProperty(rule, '_predicate', {
				get: () => ({ size: 0 }),
				configurable: true,
			});

			// _targetCondition is NOT stubbed — exercises the real getter with missing field
			expect(() => rule.afterPrepareData()).not.toThrow();
			expect(actor.system.damageBonuses?.[0]?.targetCondition).toBeNull();
		});

		it('should serialize a non-empty targetCondition as RawPredicate on the bonus entry', () => {
			const actor = createMockActor({ level: 5 });
			const rule = createDamageBonusRule({ value: '3', delivery: 'any', source: 'any' }, actor);

			// Override _targetCondition with a real Predicate-like object
			const mockPredicate = {
				size: 1,
				toObject: () => ({ target: 'bloodied' }),
			};
			Object.defineProperty(rule, '_targetCondition', {
				get: () => mockPredicate,
				configurable: true,
			});

			rule.afterPrepareData();

			expect(actor.system.damageBonuses?.[0]?.targetCondition).toEqual({
				target: 'bloodied',
			});
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

		it('declares choices on damageType, delivery, and source', () => {
			const schema = DamageBonusRule.defineSchema();
			const damageType = schema.damageType as unknown as { choices: () => Record<string, string> };
			const delivery = schema.delivery as unknown as { choices: string[] };
			const source = schema.source as unknown as { choices: string[] };

			expect(typeof damageType.choices).toBe('function');
			expect(delivery.choices).toEqual(['melee', 'ranged', 'any']);
			expect(source.choices).toEqual(['weapon', 'spell', 'any']);
		});
	});

	describe('class metadata', () => {
		it('exposes the picker group and i18n description key', () => {
			expect(DamageBonusRule.group).toBe('bonuses');
			expect(DamageBonusRule.description).toBe('NIMBLE.rules.damageBonus.description');
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
					{
						value: 3,
						formula: null,
						damageType: '',
						delivery: 'melee' as const,
						source: 'weapon' as const,
					},
					{
						value: 2,
						formula: null,
						damageType: '',
						delivery: 'melee' as const,
						source: 'weapon' as const,
					},
				],
			},
		};

		expect(getDamageBonusTotal(actor, 'melee', 'weapon')).toBe(5);
	});

	it('should include "any" delivery bonuses', () => {
		const actor = {
			system: {
				damageBonuses: [
					{
						value: 3,
						formula: null,
						damageType: '',
						delivery: 'melee' as const,
						source: 'weapon' as const,
					},
					{
						value: 4,
						formula: null,
						damageType: '',
						delivery: 'any' as const,
						source: 'any' as const,
					},
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
					{
						value: 3,
						formula: null,
						damageType: '',
						delivery: 'melee' as const,
						source: 'weapon' as const,
					},
				],
			},
		};

		expect(getDamageBonusTotal(actor, 'ranged', 'weapon')).toBe(0);
	});

	it('should exclude non-matching source', () => {
		const actor = {
			system: {
				damageBonuses: [
					{
						value: 5,
						formula: null,
						damageType: '',
						delivery: 'any' as const,
						source: 'spell' as const,
					},
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
						formula: null,
						damageType: 'lightning',
						delivery: 'any' as const,
						source: 'spell' as const,
					},
					{
						value: 2,
						formula: null,
						damageType: 'fire',
						delivery: 'any' as const,
						source: 'spell' as const,
					},
					{
						value: 1,
						formula: null,
						damageType: '',
						delivery: 'any' as const,
						source: 'spell' as const,
					},
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
							formula: null,
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
							formula: null,
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
							formula: null,
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
							formula: null,
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

describe('DamageBonusRule — dice-based values', () => {
	it('should store dice formula as raw string instead of resolving', () => {
		const actor = createMockActor({});
		const rule = createDamageBonusRule({ value: '1d6', delivery: 'any', source: 'any' }, actor);

		rule.afterPrepareData();

		expect(actor.system.damageBonuses).toEqual([
			{
				value: null,
				formula: '1d6',
				damageType: '',
				delivery: 'any',
				source: 'any',
				targetCondition: null,
			},
		]);
	});

	it('should store complex dice formula with modifiers', () => {
		const actor = createMockActor({});
		const rule = createDamageBonusRule(
			{ value: '2d8+5', delivery: 'melee', source: 'weapon' },
			actor,
		);

		rule.afterPrepareData();

		expect(actor.system.damageBonuses![0].value).toBeNull();
		expect(actor.system.damageBonuses![0].formula).toBe('2d8+5');
	});

	it('should stack numeric and dice bonuses in the same array', () => {
		const actor = createMockActor({ level: 5 });

		const numericRule = createDamageBonusRule(
			{ value: '3', delivery: 'melee', source: 'weapon' },
			actor,
		);
		const diceRule = createDamageBonusRule(
			{ value: '1d6', delivery: 'melee', source: 'weapon' },
			actor,
		);

		numericRule.afterPrepareData();
		diceRule.afterPrepareData();

		expect(actor.system.damageBonuses).toHaveLength(2);
		expect(actor.system.damageBonuses![0].value).toBe(3);
		expect(actor.system.damageBonuses![0].formula).toBeNull();
		expect(actor.system.damageBonuses![1].value).toBeNull();
		expect(actor.system.damageBonuses![1].formula).toBe('1d6');
	});
});

describe('getDamageBonusFormulas', () => {
	it('should return empty array for null actor', () => {
		expect(getDamageBonusFormulas(null, 'melee', 'weapon')).toEqual([]);
	});

	it('should return empty array when no dice bonuses match', () => {
		const actor = {
			system: {
				damageBonuses: [
					{
						value: 5,
						formula: null,
						damageType: '',
						delivery: 'melee' as const,
						source: 'weapon' as const,
					},
				],
			},
		};

		expect(getDamageBonusFormulas(actor, 'melee', 'weapon')).toEqual([]);
	});

	it('should return matching dice formulas', () => {
		const actor = {
			system: {
				damageBonuses: [
					{
						value: null,
						formula: '1d6',
						damageType: '',
						delivery: 'melee' as const,
						source: 'weapon' as const,
					},
					{
						value: null,
						formula: '2d8',
						damageType: '',
						delivery: 'melee' as const,
						source: 'weapon' as const,
					},
				],
			},
		};

		expect(getDamageBonusFormulas(actor, 'melee', 'weapon')).toEqual(['1d6', '2d8']);
	});

	it('should filter dice formulas by delivery and source', () => {
		const actor = {
			system: {
				damageBonuses: [
					{
						value: null,
						formula: '1d6',
						damageType: '',
						delivery: 'melee' as const,
						source: 'weapon' as const,
					},
					{
						value: null,
						formula: '2d8',
						damageType: '',
						delivery: 'ranged' as const,
						source: 'weapon' as const,
					},
				],
			},
		};

		expect(getDamageBonusFormulas(actor, 'melee', 'weapon')).toEqual(['1d6']);
		expect(getDamageBonusFormulas(actor, 'ranged', 'weapon')).toEqual(['2d8']);
	});

	it('should exclude numeric bonuses from formulas result', () => {
		const actor = {
			system: {
				damageBonuses: [
					{
						value: 5,
						formula: null,
						damageType: '',
						delivery: 'melee' as const,
						source: 'weapon' as const,
					},
					{
						value: null,
						formula: '1d6',
						damageType: '',
						delivery: 'melee' as const,
						source: 'weapon' as const,
					},
				],
			},
		};

		// getDamageBonusTotal only sums numeric
		expect(getDamageBonusTotal(actor, 'melee', 'weapon')).toBe(5);
		// getDamageBonusFormulas only returns dice
		expect(getDamageBonusFormulas(actor, 'melee', 'weapon')).toEqual(['1d6']);
	});
});

describe('targetCondition filtering', () => {
	it('should include bonus when targetCondition matches target domain', () => {
		const actor = {
			system: {
				damageBonuses: [
					{
						value: 5,
						formula: null,
						damageType: '',
						delivery: 'any' as const,
						source: 'any' as const,
						targetCondition: { target: 'bloodied' },
					},
				],
			},
		};

		const targetDomain = new Set(['target:bloodied']);
		expect(getDamageBonusTotal(actor, 'melee', 'weapon', undefined, targetDomain)).toBe(5);
	});

	it('should exclude bonus when targetCondition does not match target domain', () => {
		const actor = {
			system: {
				damageBonuses: [
					{
						value: 5,
						formula: null,
						damageType: '',
						delivery: 'any' as const,
						source: 'any' as const,
						targetCondition: { target: 'bloodied' },
					},
				],
			},
		};

		const targetDomain = new Set(['target:concentrating']);
		expect(getDamageBonusTotal(actor, 'melee', 'weapon', undefined, targetDomain)).toBe(0);
	});

	it('should exclude bonus with targetCondition when no target domain is provided', () => {
		const actor = {
			system: {
				damageBonuses: [
					{
						value: 5,
						formula: null,
						damageType: '',
						delivery: 'any' as const,
						source: 'any' as const,
						targetCondition: { target: 'marked' },
					},
				],
			},
		};

		// No target selected — targetCondition bonuses should not apply
		expect(getDamageBonusTotal(actor, 'melee', 'weapon')).toBe(0);
	});

	it('should include bonus without targetCondition regardless of target domain', () => {
		const actor = {
			system: {
				damageBonuses: [
					{
						value: 3,
						formula: null,
						damageType: '',
						delivery: 'any' as const,
						source: 'any' as const,
						targetCondition: null,
					},
				],
			},
		};

		expect(getDamageBonusTotal(actor, 'melee', 'weapon')).toBe(3);
		expect(getDamageBonusTotal(actor, 'melee', 'weapon', undefined, new Set())).toBe(3);
	});

	it('should filter dice formulas by targetCondition', () => {
		const actor = {
			system: {
				damageBonuses: [
					{
						value: null,
						formula: '1d6',
						damageType: '',
						delivery: 'any' as const,
						source: 'any' as const,
						targetCondition: { target: 'marked' },
					},
					{
						value: null,
						formula: '2d8',
						damageType: '',
						delivery: 'any' as const,
						source: 'any' as const,
						targetCondition: null,
					},
				],
			},
		};

		// Without target — only unconditional bonus
		expect(getDamageBonusFormulas(actor, 'melee', 'weapon')).toEqual(['2d8']);

		// With matching target — both
		const targetDomain = new Set(['target:marked']);
		expect(getDamageBonusFormulas(actor, 'melee', 'weapon', undefined, targetDomain)).toEqual([
			'1d6',
			'2d8',
		]);
	});

	it('should combine delivery/source filtering with targetCondition', () => {
		const actor = {
			system: {
				damageBonuses: [
					{
						value: 5,
						formula: null,
						damageType: '',
						delivery: 'melee' as const,
						source: 'weapon' as const,
						targetCondition: { target: 'bloodied' },
					},
				],
			},
		};

		const targetDomain = new Set(['target:bloodied']);

		// Matches delivery + source + target
		expect(getDamageBonusTotal(actor, 'melee', 'weapon', undefined, targetDomain)).toBe(5);

		// Matches target but not delivery
		expect(getDamageBonusTotal(actor, 'ranged', 'weapon', undefined, targetDomain)).toBe(0);

		// Matches delivery but not target
		expect(
			getDamageBonusTotal(actor, 'melee', 'weapon', undefined, new Set(['target:fullHp'])),
		).toBe(0);
	});
});
