import { describe, expect, it } from 'vitest';
import { IncrementHitDiceRule } from './incrementHitDice.js';

describe('IncrementHitDiceRule', () => {
	describe('schema', () => {
		it('defines the expected fields', () => {
			const schema = IncrementHitDiceRule.defineSchema();
			expect(schema).toHaveProperty('type');
			expect(schema).toHaveProperty('value');
		});
	});

	describe('class metadata', () => {
		it('exposes the picker group and i18n description key', () => {
			expect(IncrementHitDiceRule.group).toBe('bonuses');
			expect(IncrementHitDiceRule.description).toBe('NIMBLE.rules.incrementHitDice.description');
		});
	});
});
