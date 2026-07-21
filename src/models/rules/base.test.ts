import { describe, expect, it } from 'vitest';
import { NimbleBaseRule } from './base.js';

describe('NimbleBaseRule', () => {
	describe('schema', () => {
		it('defines the expected base fields inherited by every rule', () => {
			const schema = NimbleBaseRule.defineSchema();

			expect(schema).toHaveProperty('disabled');
			expect(schema).toHaveProperty('id');
			expect(schema).toHaveProperty('identifier');
			expect(schema).toHaveProperty('label');
			expect(schema).toHaveProperty('predicate');
			expect(schema).toHaveProperty('priority');
			expect(schema).toHaveProperty('suppressActivationCard');
		});

		it('defaults suppressActivationCard to auto with the expected choices', () => {
			const schema = NimbleBaseRule.defineSchema();
			const field = schema.suppressActivationCard as unknown as {
				initial: unknown;
				choices: string[];
			};

			expect(field.initial).toBe('auto');
			expect(field.choices).toEqual(['auto', 'always', 'never']);
		});
	});

	describe('suppressesActivationCard resolution', () => {
		class AutoFalseRule extends NimbleBaseRule {}

		class AutoTrueRule extends NimbleBaseRule {
			protected override _autoSuppressesActivationCard(): boolean {
				return true;
			}
		}

		function createRule(
			RuleClass: typeof AutoFalseRule | typeof AutoTrueRule,
			suppressActivationCard: string,
		) {
			const rule = new (RuleClass as any)(
				{ type: 'test', label: '', identifier: '', predicate: {} },
				{ strict: false },
			);
			(rule as any).suppressActivationCard = suppressActivationCard;
			return rule as NimbleBaseRule;
		}

		it('resolves `always` to true even when the auto branch is false', () => {
			expect(createRule(AutoFalseRule, 'always').suppressesActivationCard()).toBe(true);
		});

		it('resolves `never` to false even when the auto branch is true', () => {
			expect(createRule(AutoTrueRule, 'never').suppressesActivationCard()).toBe(false);
		});

		it('resolves `auto` to the rule class behavior', () => {
			expect(createRule(AutoFalseRule, 'auto').suppressesActivationCard()).toBe(false);
			expect(createRule(AutoTrueRule, 'auto').suppressesActivationCard()).toBe(true);
		});

		it('gates only the `auto` branch on automation being enabled', () => {
			const context = { automationEnabled: false };

			expect(createRule(AutoTrueRule, 'auto').suppressesActivationCard(context)).toBe(false);
			expect(createRule(AutoFalseRule, 'always').suppressesActivationCard(context)).toBe(true);
		});
	});

	describe('class-level metadata', () => {
		it('defaults `group` to "unsorted" so the picker can flag unconfigured rules', () => {
			expect(NimbleBaseRule.group).toBe('unsorted');
		});

		it('defaults `description` to "" so the picker can flag missing copy', () => {
			expect(NimbleBaseRule.description).toBe('');
		});
	});
});
