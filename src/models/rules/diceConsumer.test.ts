import { describe, expect, it } from 'vitest';
import { DiceConsumerRule } from './diceConsumer.js';

describe('DiceConsumerRule', () => {
	describe('schema', () => {
		it('defines the expected fields', () => {
			const schema = DiceConsumerRule.defineSchema();
			expect(schema).toHaveProperty('type');
			expect(schema).toHaveProperty('poolIdentifier');
			expect(schema).toHaveProperty('poolScope');
			expect(schema).toHaveProperty('mode');
			expect(schema).toHaveProperty('cost');
			expect(schema).toHaveProperty('bonusOnAttackDelivery');
			expect(schema).toHaveProperty('effectFormula');
			expect(schema).toHaveProperty('effectType');
		});

		it('defaults effectFormula to null', () => {
			const schema = DiceConsumerRule.defineSchema();
			const effectFormula = schema.effectFormula as unknown as { initial: unknown };
			expect(effectFormula.initial).toBeNull();
		});

		it('defaults effectType to generic with the expected choices', () => {
			const schema = DiceConsumerRule.defineSchema();
			const effectType = schema.effectType as unknown as { initial: unknown; choices: string[] };
			expect(effectType.initial).toBe('generic');
			expect(effectType.choices).toEqual(['generic', 'damageReduction']);
		});
	});

	describe('class metadata', () => {
		it('exposes the picker group and i18n description key', () => {
			expect(DiceConsumerRule.group).toBe('resource');
			expect(DiceConsumerRule.description).toBe('NIMBLE.rules.diceConsumer.description');
		});
	});
});
