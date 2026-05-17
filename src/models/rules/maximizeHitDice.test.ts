import { describe, expect, it } from 'vitest';
import { MaximizeHitDiceRule } from './maximizeHitDice.js';

describe('MaximizeHitDiceRule', () => {
	describe('schema', () => {
		it('defines only the type discriminator (no rule-specific fields)', () => {
			const schema = MaximizeHitDiceRule.defineSchema();
			expect(schema).toHaveProperty('type');
		});
	});

	describe('class metadata', () => {
		it('exposes the picker group and i18n description key', () => {
			expect(MaximizeHitDiceRule.group).toBe('bonuses');
			expect(MaximizeHitDiceRule.description).toBe('NIMBLE.rules.maximizeHitDice.description');
		});
	});
});
