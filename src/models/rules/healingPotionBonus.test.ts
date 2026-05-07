import { describe, expect, it } from 'vitest';
import { HealingPotionBonusRule } from './healingPotionBonus.js';

describe('HealingPotionBonusRule', () => {
	describe('schema', () => {
		it('defines the expected fields', () => {
			const schema = HealingPotionBonusRule.defineSchema();
			expect(schema).toHaveProperty('type');
			expect(schema).toHaveProperty('value');
		});
	});

	describe('class metadata', () => {
		it('exposes the picker group and i18n description key', () => {
			expect(HealingPotionBonusRule.group).toBe('bonuses');
			expect(HealingPotionBonusRule.description).toBe('NIMBLE.ruleDescriptions.healingPotionBonus');
		});
	});
});
