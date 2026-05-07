import { describe, expect, it } from 'vitest';
import { MaxHitDiceRule } from './maxHitDice.js';

describe('MaxHitDiceRule', () => {
	describe('schema', () => {
		it('defines the expected fields', () => {
			const schema = MaxHitDiceRule.defineSchema();
			expect(schema).toHaveProperty('type');
			expect(schema).toHaveProperty('value');
			expect(schema).toHaveProperty('dieSize');
		});
	});

	describe('class metadata', () => {
		it('exposes the picker group and i18n description key', () => {
			expect(MaxHitDiceRule.group).toBe('bonuses');
			expect(MaxHitDiceRule.description).toBe('NIMBLE.ruleDescriptions.maxHitDice');
		});
	});
});
