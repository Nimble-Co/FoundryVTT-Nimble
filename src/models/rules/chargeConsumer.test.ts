import { describe, expect, it } from 'vitest';
import { ChargeConsumerRule } from './chargeConsumer.js';

describe('ChargeConsumerRule', () => {
	describe('schema', () => {
		it('defines the expected fields', () => {
			const schema = ChargeConsumerRule.defineSchema();
			expect(schema).toHaveProperty('type');
			expect(schema).toHaveProperty('poolIdentifier');
			expect(schema).toHaveProperty('poolScope');
			expect(schema).toHaveProperty('cost');
			expect(schema).toHaveProperty('costMode');
			expect(schema).toHaveProperty('maxCost');
		});

		it('spends a fixed cost until told otherwise', () => {
			const schema = ChargeConsumerRule.defineSchema() as any;

			expect(schema.costMode.initial).toBe('fixed');
			expect(schema.maxCost.initial).toBe('');
		});

		it('offers both cost modes with localized labels', () => {
			const schema = ChargeConsumerRule.defineSchema() as any;
			const choices = schema.costMode.choices();

			expect(choices).toEqual({
				fixed: 'NIMBLE.rules.chargeConsumer.costMode.choices.fixed',
				variable: 'NIMBLE.rules.chargeConsumer.costMode.choices.variable',
			});
		});

		it('shows the ceiling only where it applies', () => {
			const schema = ChargeConsumerRule.defineSchema() as any;
			const { showWhen } = schema.maxCost.options;

			expect(showWhen({ costMode: 'variable' })).toBe(true);
			expect(showWhen({ costMode: 'fixed' })).toBe(false);
		});
	});

	describe('class metadata', () => {
		it('exposes the picker group and i18n description key', () => {
			expect(ChargeConsumerRule.group).toBe('resource');
			expect(ChargeConsumerRule.description).toBe('NIMBLE.rules.chargeConsumer.description');
		});
	});
});
