import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ModifyIncomingAttackRule } from './modifyIncomingAttack.js';

describe('ModifyIncomingAttackRule', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('schema', () => {
		it('should define the correct schema fields', () => {
			const schema = ModifyIncomingAttackRule.defineSchema();

			expect(schema).toHaveProperty('modifier');
			expect(schema).toHaveProperty('range');
			expect(schema).toHaveProperty('type');
			expect(schema).toHaveProperty('disabled');
			expect(schema).toHaveProperty('label');
			expect(schema).toHaveProperty('predicate');
			expect(schema).toHaveProperty('priority');
		});

		it('restricts modifier to the closed choice set', () => {
			const schema = ModifyIncomingAttackRule.defineSchema();
			const modifier = schema.modifier as unknown as { choices: string[] };

			expect(modifier.choices).toEqual([
				'disadvantage',
				'forceReroll',
				'redirectToSelf',
				'autoMiss',
			]);
		});

		it('defaults modifier to disadvantage', () => {
			const schema = ModifyIncomingAttackRule.defineSchema();
			const modifier = schema.modifier as unknown as { initial: string };

			expect(modifier.initial).toBe('disadvantage');
		});

		it('defaults range to 2 spaces with a minimum of 1', () => {
			const schema = ModifyIncomingAttackRule.defineSchema();
			const range = schema.range as unknown as { initial: number; min: number; integer: boolean };

			expect(range.initial).toBe(2);
			expect(range.min).toBe(1);
			expect(range.integer).toBe(true);
		});

		it('only shows the range field for the redirectToSelf modifier', () => {
			const schema = ModifyIncomingAttackRule.defineSchema();
			const range = schema.range as unknown as {
				showWhen: (data: Record<string, unknown>) => boolean;
			};

			expect(typeof range.showWhen).toBe('function');
			expect(range.showWhen({ modifier: 'redirectToSelf' })).toBe(true);
			expect(range.showWhen({ modifier: 'disadvantage' })).toBe(false);
			expect(range.showWhen({ modifier: 'forceReroll' })).toBe(false);
			expect(range.showWhen({ modifier: 'autoMiss' })).toBe(false);
		});

		it('restricts rerollTrigger to always / hit / criticalHit, defaulting to always', () => {
			const schema = ModifyIncomingAttackRule.defineSchema();
			const trigger = schema.rerollTrigger as unknown as { choices: string[]; initial: string };

			expect(trigger.choices).toEqual(['always', 'hit', 'criticalHit']);
			expect(trigger.initial).toBe('always');
		});

		it('exposes automatic and rerollWithDisadvantage flags gated to forceReroll', () => {
			const schema = ModifyIncomingAttackRule.defineSchema();
			const flags = ['automatic', 'rerollTrigger', 'rerollWithDisadvantage'] as const;
			for (const key of flags) {
				const field = schema[key] as unknown as {
					showWhen: (data: Record<string, unknown>) => boolean;
				};
				expect(field.showWhen({ modifier: 'forceReroll' })).toBe(true);
				expect(field.showWhen({ modifier: 'disadvantage' })).toBe(false);
			}
		});

		it('fixes the type field initial to modifyIncomingAttack', () => {
			const schema = ModifyIncomingAttackRule.defineSchema();
			const type = schema.type as unknown as { initial: string };

			expect(type.initial).toBe('modifyIncomingAttack');
		});

		it('carries i18n labels and hints on the editable fields', () => {
			const schema = ModifyIncomingAttackRule.defineSchema();
			const modifier = schema.modifier as unknown as { label: string; hint: string };
			const range = schema.range as unknown as { label: string; hint: string };

			expect(modifier.label).toBe('NIMBLE.rules.modifyIncomingAttack.modifier.label');
			expect(modifier.hint).toBe('NIMBLE.rules.modifyIncomingAttack.modifier.hint');
			expect(range.label).toBe('NIMBLE.rules.modifyIncomingAttack.range.label');
			expect(range.hint).toBe('NIMBLE.rules.modifyIncomingAttack.range.hint');
		});
	});

	describe('class metadata', () => {
		it('exposes the picker group and i18n description key', () => {
			expect(ModifyIncomingAttackRule.group).toBe('bonuses');
			expect(ModifyIncomingAttackRule.description).toBe(
				'NIMBLE.rules.modifyIncomingAttack.description',
			);
		});
	});

	describe('registration', () => {
		it('is registered in CONFIG.NIMBLE rule data models and type labels', () => {
			const config = (globalThis as unknown as { CONFIG: { NIMBLE: Record<string, unknown> } })
				.CONFIG.NIMBLE;
			const ruleDataModels = config.ruleDataModels as Record<string, unknown>;
			const ruleTypes = config.ruleTypes as Record<string, string>;

			expect(ruleDataModels.modifyIncomingAttack).toBe(ModifyIncomingAttackRule);
			expect(ruleTypes.modifyIncomingAttack).toBeTruthy();
		});
	});
});
