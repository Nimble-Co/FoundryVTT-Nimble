import { describe, expect, it } from 'vitest';
import { SkillBonusRule } from './skillBonus.js';

describe('SkillBonusRule', () => {
	describe('schema', () => {
		it('defines the expected fields', () => {
			const schema = SkillBonusRule.defineSchema();
			expect(schema).toHaveProperty('type');
			expect(schema).toHaveProperty('value');
			expect(schema).toHaveProperty('skills');
		});

		it('declares choices on skills array (with `all` sentinel)', () => {
			const schema = SkillBonusRule.defineSchema();
			const arrayField = schema.skills as { element: { choices: () => string[] } };
			const choices = arrayField.element.choices();
			expect(choices).toContain('all');
			expect(choices).toContain('arcana');
		});
	});

	describe('class metadata', () => {
		it('exposes the picker group and i18n description key', () => {
			expect(SkillBonusRule.group).toBe('bonuses');
			expect(SkillBonusRule.description).toBe('NIMBLE.ruleDescriptions.skillBonus');
		});
	});
});
