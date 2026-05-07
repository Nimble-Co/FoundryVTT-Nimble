import { describe, expect, it } from 'vitest';
import { InitiativeBonusRule } from './initiativeBonus.js';

describe('InitiativeBonusRule', () => {
	describe('schema', () => {
		it('defines the expected fields', () => {
			const schema = InitiativeBonusRule.defineSchema();
			expect(schema).toHaveProperty('type');
			expect(schema).toHaveProperty('value');
		});
	});

	describe('class metadata', () => {
		it('exposes the picker group and i18n description key', () => {
			expect(InitiativeBonusRule.group).toBe('bonuses');
			expect(InitiativeBonusRule.description).toBe('NIMBLE.ruleDescriptions.initiativeBonus');
		});
	});
});
