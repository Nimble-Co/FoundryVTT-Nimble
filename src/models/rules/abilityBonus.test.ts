import { describe, expect, it } from 'vitest';
import { AbilityBonusRule } from './abilityBonus.js';

describe('AbilityBonusRule', () => {
	describe('schema', () => {
		it('defines the expected fields', () => {
			const schema = AbilityBonusRule.defineSchema();
			expect(schema).toHaveProperty('type');
			expect(schema).toHaveProperty('value');
			expect(schema).toHaveProperty('abilities');
		});

		it('declares choices on the abilities array element (with `all` sentinel)', () => {
			const schema = AbilityBonusRule.defineSchema();
			const arrayField = schema.abilities as unknown as { element: { choices: () => string[] } };
			const choices = arrayField.element.choices();
			expect(choices).toContain('all');
			expect(choices).toContain('strength');
		});
	});

	describe('class metadata', () => {
		it('exposes the picker group and i18n description key', () => {
			expect(AbilityBonusRule.group).toBe('bonuses');
			expect(AbilityBonusRule.description).toBe('NIMBLE.rules.abilityBonus.description');
		});
	});
});
