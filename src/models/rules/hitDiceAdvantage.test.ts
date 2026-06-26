import { describe, expect, it } from 'vitest';
import { HitDiceAdvantageRule } from './hitDiceAdvantage.js';

describe('HitDiceAdvantageRule', () => {
	describe('schema', () => {
		it('defines the expected fields', () => {
			const schema = HitDiceAdvantageRule.defineSchema();
			expect(schema).toHaveProperty('type');
			expect(schema).toHaveProperty('condition');
			expect(schema).toHaveProperty('amount');
			expect(schema).toHaveProperty('rollContext');
		});

		it('defaults amount to 1 and rollContext to fieldRest', () => {
			const schema = HitDiceAdvantageRule.defineSchema();
			expect(schema.amount.initial).toBe(1);
			expect(schema.rollContext.initial).toBe('fieldRest');
		});
	});

	describe('class metadata', () => {
		it('exposes the picker group and i18n description key', () => {
			expect(HitDiceAdvantageRule.group).toBe('bonuses');
			expect(HitDiceAdvantageRule.description).toBe('NIMBLE.rules.hitDiceAdvantage.description');
		});
	});
});
