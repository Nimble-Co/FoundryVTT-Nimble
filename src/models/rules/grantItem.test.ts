import { describe, expect, it } from 'vitest';
import { ItemGrantRule } from './grantItem.js';

describe('ItemGrantRule', () => {
	describe('schema', () => {
		it('defines the expected fields', () => {
			const schema = ItemGrantRule.defineSchema();
			expect(schema).toHaveProperty('type');
			expect(schema).toHaveProperty('allowDuplicate');
			expect(schema).toHaveProperty('inMemoryOnly');
			expect(schema).toHaveProperty('quantity');
			expect(schema).toHaveProperty('uuid');
		});
	});

	describe('class metadata', () => {
		it('exposes the picker group and i18n description key', () => {
			expect(ItemGrantRule.group).toBe('grants');
			expect(ItemGrantRule.description).toBe('NIMBLE.ruleDescriptions.grantItem');
		});
	});
});
