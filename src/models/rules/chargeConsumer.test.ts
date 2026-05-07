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
		});
	});

	describe('class metadata', () => {
		it('exposes the picker group and i18n description key', () => {
			expect(ChargeConsumerRule.group).toBe('resource');
			expect(ChargeConsumerRule.description).toBe('NIMBLE.ruleDescriptions.chargeConsumer');
		});
	});
});
