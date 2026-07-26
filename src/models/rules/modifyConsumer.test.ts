import { describe, expect, it } from 'vitest';

import { ModifyConsumerRule } from './modifyConsumer.js';

describe('ModifyConsumerRule', () => {
	describe('schema', () => {
		it('defines the expected fields', () => {
			const schema = ModifyConsumerRule.defineSchema();
			expect(schema).toHaveProperty('type');
			expect(schema).toHaveProperty('poolIdentifier');
			expect(schema).toHaveProperty('effectTypeFilter');
			expect(schema).toHaveProperty('appendFormula');
		});

		it('defaults type to modifyConsumer', () => {
			const schema = ModifyConsumerRule.defineSchema();
			const typeField = schema.type as unknown as { initial: string };
			expect(typeField.initial).toBe('modifyConsumer');
		});

		it('offers blank plus the dice-pool effect types as filter choices', () => {
			const schema = ModifyConsumerRule.defineSchema();
			const filterField = schema.effectTypeFilter as unknown as { choices: readonly string[] };
			expect([...filterField.choices]).toEqual(['', 'generic', 'damageReduction']);
		});

		it('defaults the filter and formula to blank', () => {
			const schema = ModifyConsumerRule.defineSchema();
			const filterField = schema.effectTypeFilter as unknown as { initial: string };
			const formulaField = schema.appendFormula as unknown as { initial: string };
			expect(filterField.initial).toBe('');
			expect(formulaField.initial).toBe('');
		});
	});

	it('is registered under the resource group', () => {
		expect(ModifyConsumerRule.group).toBe('resource');
	});
});
