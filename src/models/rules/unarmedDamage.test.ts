import { describe, expect, it } from 'vitest';
import { UnarmedDamageRule } from './unarmedDamage.js';

describe('UnarmedDamageRule', () => {
	describe('schema', () => {
		it('defines the expected fields', () => {
			const schema = UnarmedDamageRule.defineSchema();
			expect(schema).toHaveProperty('type');
			expect(schema).toHaveProperty('value');
		});
	});

	describe('class metadata', () => {
		it('exposes the picker group and i18n description key', () => {
			expect(UnarmedDamageRule.group).toBe('bonuses');
			expect(UnarmedDamageRule.description).toBe('NIMBLE.ruleDescriptions.unarmedDamage');
		});
	});
});
