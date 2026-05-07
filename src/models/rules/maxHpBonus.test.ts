import { describe, expect, it } from 'vitest';
import { MaxHpBonusRule } from './maxHpBonus.js';

describe('MaxHpBonusRule', () => {
	describe('schema', () => {
		it('defines the expected fields', () => {
			const schema = MaxHpBonusRule.defineSchema();
			expect(schema).toHaveProperty('type');
			expect(schema).toHaveProperty('value');
			expect(schema).toHaveProperty('perLevel');
		});
	});

	describe('class metadata', () => {
		it('exposes the picker group and i18n description key', () => {
			expect(MaxHpBonusRule.group).toBe('bonuses');
			expect(MaxHpBonusRule.description).toBe('NIMBLE.ruleDescriptions.maxHpBonus');
		});
	});
});
