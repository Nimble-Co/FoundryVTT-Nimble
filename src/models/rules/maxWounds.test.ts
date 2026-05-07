import { describe, expect, it } from 'vitest';
import { MaxWoundsRule } from './maxWounds.js';

describe('MaxWoundsRule', () => {
	describe('schema', () => {
		it('defines the expected fields', () => {
			const schema = MaxWoundsRule.defineSchema();
			expect(schema).toHaveProperty('type');
			expect(schema).toHaveProperty('value');
		});
	});

	describe('class metadata', () => {
		it('exposes the picker group and i18n description key', () => {
			expect(MaxWoundsRule.group).toBe('bonuses');
			expect(MaxWoundsRule.description).toBe('NIMBLE.ruleDescriptions.maxWounds');
		});
	});
});
