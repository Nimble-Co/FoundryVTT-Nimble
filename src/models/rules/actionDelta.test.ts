import { describe, expect, it } from 'vitest';
import { ActionDeltaRule } from './actionDelta.js';

describe('ActionDeltaRule', () => {
	describe('schema', () => {
		it('defines the expected fields', () => {
			const schema = ActionDeltaRule.defineSchema();
			expect(schema).toHaveProperty('type');
			expect(schema).toHaveProperty('value');
			expect(schema).toHaveProperty('timing');
			expect(schema).toHaveProperty('target');
			expect(schema).toHaveProperty('borrowFromNextTurn');
		});

		it('declares closed timing and target choice sets', () => {
			const schema = ActionDeltaRule.defineSchema();
			const timing = schema.timing as unknown as { choices: string[] };
			expect(timing.choices).toEqual(['now', 'nextTurn']);

			const target = schema.target as unknown as { choices: string[] };
			expect(target.choices).toEqual(['self', 'targeted', 'allAllies']);
		});

		it('defaults to an immediate self-grant of 1 that does not borrow', () => {
			const schema = ActionDeltaRule.defineSchema();
			const value = schema.value as unknown as { options: { initial: string } };
			expect(value.options.initial).toBe('1');

			const timing = schema.timing as unknown as { options: { initial: string } };
			expect(timing.options.initial).toBe('now');

			const target = schema.target as unknown as { options: { initial: string } };
			expect(target.options.initial).toBe('self');

			const borrowFromNextTurn = schema.borrowFromNextTurn as unknown as {
				options: { initial: boolean };
			};
			expect(borrowFromNextTurn.options.initial).toBe(false);
		});
	});

	describe('class metadata', () => {
		it('exposes the picker group and i18n description key', () => {
			expect(ActionDeltaRule.group).toBe('resource');
			expect(ActionDeltaRule.description).toBe('NIMBLE.rules.actionDelta.description');
		});

		it('declares no lifecycle hooks', () => {
			// A pure action-adjustment descriptor must never run during data preparation.
			expect(ActionDeltaRule.appliesInPrePrepareData).toBe(false);
			expect(Object.getOwnPropertyNames(ActionDeltaRule.prototype)).not.toContain(
				'afterPrepareData',
			);
		});
	});

	function createRule(
		config: {
			timing?: 'now' | 'nextTurn';
			target?: 'self' | 'targeted' | 'allAllies';
			borrowFromNextTurn?: boolean;
			resolvedValue?: number | null;
		} = {},
	) {
		const rule = new ActionDeltaRule(
			{ type: 'actionDelta' } as foundry.data.fields.SchemaField.CreateData<
				ActionDeltaRule['schema']['fields']
			>,
			{ strict: false },
		) as ActionDeltaRule;

		rule.timing = config.timing ?? 'now';
		rule.target = config.target ?? 'self';
		rule.borrowFromNextTurn = config.borrowFromNextTurn ?? false;
		// Bypass the actor-backed formula resolution — resolveApplication's
		// timing/borrow arithmetic is the unit under test.
		Object.defineProperty(rule, 'resolveValue', {
			value: () => config.resolvedValue ?? null,
		});
		return rule;
	}

	describe('resolveApplication', () => {
		it('applies an immediate grant to the current pool only', () => {
			const rule = createRule({ timing: 'now', resolvedValue: 2 });
			expect(rule.resolveApplication()).toEqual({ currentDelta: 2, pendingDelta: 0 });
		});

		it('applies a next-turn grant to the pending delta only', () => {
			const rule = createRule({ timing: 'nextTurn', resolvedValue: 2 });
			expect(rule.resolveApplication()).toEqual({ currentDelta: 0, pendingDelta: 2 });
		});

		it('supports negative values (action denial)', () => {
			const rule = createRule({ timing: 'now', resolvedValue: -1 });
			expect(rule.resolveApplication()).toEqual({ currentDelta: -1, pendingDelta: 0 });
		});

		it('borrowing grants now and owes the same amount next turn as one combined adjustment', () => {
			const rule = createRule({ timing: 'now', borrowFromNextTurn: true, resolvedValue: 2 });
			expect(rule.resolveApplication()).toEqual({ currentDelta: 2, pendingDelta: -2 });
		});

		it('ignores borrowing for next-turn grants', () => {
			const rule = createRule({ timing: 'nextTurn', borrowFromNextTurn: true, resolvedValue: 2 });
			expect(rule.resolveApplication()).toEqual({ currentDelta: 0, pendingDelta: 2 });
		});

		it('is null for an unresolvable value', () => {
			const rule = createRule({ resolvedValue: null });
			expect(rule.resolveApplication()).toBeNull();
		});

		it('is null for a zero value', () => {
			const rule = createRule({ resolvedValue: 0 });
			expect(rule.resolveApplication()).toBeNull();
		});

		it('truncates fractional values', () => {
			const rule = createRule({ timing: 'now', borrowFromNextTurn: true, resolvedValue: 2.7 });
			expect(rule.resolveApplication()).toEqual({ currentDelta: 2, pendingDelta: -2 });
		});
	});
});
