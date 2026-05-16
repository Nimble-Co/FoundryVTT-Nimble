import { describe, expect, it } from 'vitest';
import { DicePoolRule } from './dicePool.js';
import { ModifyPoolRule } from './modifyPool.js';

describe('DicePoolRule schema', () => {
	it('defines required schema fields', () => {
		const schema = DicePoolRule.defineSchema();

		expect(schema).toHaveProperty('type');
		expect(schema).toHaveProperty('scope');
		expect(schema).toHaveProperty('dieSize');
		expect(schema).toHaveProperty('max');
		expect(schema).toHaveProperty('initial');
		expect(schema).toHaveProperty('refills');
		expect(schema).toHaveProperty('disabled');
		expect(schema).toHaveProperty('predicate');
		expect(schema).toHaveProperty('priority');
		expect(schema).toHaveProperty('identifier');
		expect(schema).toHaveProperty('label');
	});

	it('produces a tooltipInfo string describing all custom fields', () => {
		const rule = new DicePoolRule(
			{
				id: 'test-id',
				identifier: 'fury',
				label: 'Fury Dice',
				disabled: false,
				priority: 1,
				predicate: {},
				type: 'dicePool',
				scope: 'item',
				dieSize: 'd4',
				max: '@abilities.strength.value',
				initial: 'zero',
				refills: [],
			} as unknown as foundry.data.fields.SchemaField.CreateData<DicePoolRule['schema']['fields']>,
			{ strict: false },
		);

		const tooltip = rule.tooltipInfo();
		expect(tooltip).toContain('scope');
		expect(tooltip).toContain('dieSize');
		expect(tooltip).toContain('max');
		expect(tooltip).toContain('initial');
		expect(tooltip).toContain('refills');
	});
});

describe('ModifyPoolRule schema', () => {
	it('defines required schema fields', () => {
		const schema = ModifyPoolRule.defineSchema();

		expect(schema).toHaveProperty('type');
		expect(schema).toHaveProperty('poolType');
		expect(schema).toHaveProperty('poolIdentifier');
		expect(schema).toHaveProperty('dieSize');
		expect(schema).toHaveProperty('maxDelta');
	});

	it('allows null dieSize and null maxDelta', () => {
		const rule = new ModifyPoolRule(
			{
				id: 'mod-id',
				identifier: '',
				label: '',
				disabled: false,
				priority: 1,
				predicate: {},
				type: 'modifyPool',
				poolType: 'dice',
				poolIdentifier: 'fury',
				dieSize: null,
				maxDelta: null,
			} as unknown as foundry.data.fields.SchemaField.CreateData<
				ModifyPoolRule['schema']['fields']
			>,
			{ strict: false },
		);
		// Tests run against a minimal DataModel mock that does not auto-assign schema fields;
		// mirror the speedBonus.test.ts pattern of manual assignment.
		(rule as unknown as { poolType: string }).poolType = 'dice';
		(rule as unknown as { poolIdentifier: string }).poolIdentifier = 'fury';
		(rule as unknown as { dieSize: null }).dieSize = null;
		(rule as unknown as { maxDelta: null }).maxDelta = null;

		expect(rule.poolType).toBe('dice');
		expect(rule.poolIdentifier).toBe('fury');
		expect(rule.dieSize).toBeNull();
		expect(rule.maxDelta).toBeNull();
	});

	it('produces a tooltipInfo string describing all custom fields', () => {
		const rule = new ModifyPoolRule(
			{
				id: 'mod-id',
				identifier: '',
				label: '',
				disabled: false,
				priority: 1,
				predicate: {},
				type: 'modifyPool',
				poolType: 'charge',
				poolIdentifier: 'combat-dice',
				dieSize: 'd8',
				maxDelta: '+1',
			} as unknown as foundry.data.fields.SchemaField.CreateData<
				ModifyPoolRule['schema']['fields']
			>,
			{ strict: false },
		);

		const tooltip = rule.tooltipInfo();
		expect(tooltip).toContain('poolType');
		expect(tooltip).toContain('poolIdentifier');
		expect(tooltip).toContain('dieSize');
		expect(tooltip).toContain('maxDelta');
	});
});
