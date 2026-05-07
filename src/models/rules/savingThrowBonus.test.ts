import { describe, expect, it } from 'vitest';
import { SavingThrowBonusRule } from './savingThrowBonus.js';

describe('SavingThrowBonusRule', () => {
	describe('schema', () => {
		it('defines the expected fields', () => {
			const schema = SavingThrowBonusRule.defineSchema();
			expect(schema).toHaveProperty('type');
			expect(schema).toHaveProperty('value');
			expect(schema).toHaveProperty('savingThrows');
		});

		it('declares choices on savingThrows array (with `all` sentinel)', () => {
			const schema = SavingThrowBonusRule.defineSchema();
			const arrayField = schema.savingThrows as unknown as { element: { choices: () => string[] } };
			const choices = arrayField.element.choices();
			expect(choices).toContain('all');
			expect(choices).toContain('strength');
		});
	});

	describe('class metadata', () => {
		it('exposes the picker group and i18n description key', () => {
			expect(SavingThrowBonusRule.group).toBe('bonuses');
			expect(SavingThrowBonusRule.description).toBe('NIMBLE.ruleDescriptions.savingThrowBonus');
		});
	});
});
