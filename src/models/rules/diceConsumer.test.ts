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
		});
	});

	describe('class metadata', () => {
		it('exposes the picker group and i18n description key', () => {
			expect(DiceConsumerRule.group).toBe('resource');
			expect(DiceConsumerRule.description).toBe('NIMBLE.rules.diceConsumer.description');
		});
	});
});
