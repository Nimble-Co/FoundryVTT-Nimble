import { describe, expect, it } from 'vitest';
import { ChargePoolRule } from './chargePool.js';

describe('ChargePoolRule', () => {
	describe('schema', () => {
		it('defines the expected fields', () => {
			const schema = ChargePoolRule.defineSchema();
			expect(schema).toHaveProperty('type');
			expect(schema).toHaveProperty('scope');
			expect(schema).toHaveProperty('max');
			expect(schema).toHaveProperty('initial');
			expect(schema).toHaveProperty('recoveries');
		});
	});

	describe('class metadata', () => {
		it('exposes the picker group and i18n description key', () => {
			expect(ChargePoolRule.group).toBe('resource');
			expect(ChargePoolRule.description).toBe('NIMBLE.ruleDescriptions.chargePool');
		});
	});
});
