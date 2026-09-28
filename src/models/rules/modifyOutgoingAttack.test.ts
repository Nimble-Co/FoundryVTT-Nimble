import { describe, expect, it } from 'vitest';
import { ModifyOutgoingAttackRule } from './modifyOutgoingAttack.js';

describe('ModifyOutgoingAttackRule', () => {
	describe('schema', () => {
		it('defines the expected fields', () => {
			const schema = ModifyOutgoingAttackRule.defineSchema();

			expect(schema).toHaveProperty('modifier');
			expect(schema).toHaveProperty('type');
			expect(schema).toHaveProperty('disabled');
			expect(schema).toHaveProperty('label');
			expect(schema).toHaveProperty('predicate');
			expect(schema).toHaveProperty('priority');
		});

		it('restricts modifier to the closed choice set', () => {
			const schema = ModifyOutgoingAttackRule.defineSchema();
			const modifier = schema.modifier as unknown as { choices: string[] };

			expect(modifier.choices).toEqual(['cannotMiss', 'ignoreArmor']);
		});

		it('defaults modifier to cannotMiss', () => {
			const schema = ModifyOutgoingAttackRule.defineSchema();
			const modifier = schema.modifier as unknown as { initial: string };

			expect(modifier.initial).toBe('cannotMiss');
		});

		it('labels and hints the modifier field for the rules builder', () => {
			const schema = ModifyOutgoingAttackRule.defineSchema();
			const modifier = schema.modifier as unknown as { label: string; hint: string };

			expect(modifier.label).toBe('NIMBLE.rules.modifyOutgoingAttack.modifier.label');
			expect(modifier.hint).toBe('NIMBLE.rules.modifyOutgoingAttack.modifier.hint');
		});
	});

	describe('class metadata', () => {
		it('exposes the picker group and i18n description key', () => {
			expect(ModifyOutgoingAttackRule.group).toBe('bonuses');
			expect(ModifyOutgoingAttackRule.description).toBe(
				'NIMBLE.rules.modifyOutgoingAttack.description',
			);
		});

		it('is not an early-phase rule, so it may predicate on late domain tags', () => {
			expect(ModifyOutgoingAttackRule.appliesInPrePrepareData).toBe(false);
		});
	});
});
