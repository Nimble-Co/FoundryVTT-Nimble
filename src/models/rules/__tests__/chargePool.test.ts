import { describe, expect, it } from 'vitest';
import { packRuleFailures, readItem } from '../../../../tests/fixtures/packContent.js';
import { PredicateField } from '../../fields/PredicateField.js';
import { ChargePoolRule } from '../chargePool.js';

type RecoveryFields = Record<
	string,
	{ choices?: Record<string, string>; label?: string; hint?: string }
>;

function recoveryFields(): RecoveryFields {
	const schema = ChargePoolRule.defineSchema();
	return (schema.recoveries as unknown as { element: { fields: RecoveryFields } }).element.fields;
}

describe('ChargePoolRule', () => {
	describe('schema', () => {
		it('defines the expected fields', () => {
			const schema = ChargePoolRule.defineSchema();
			expect(schema).toHaveProperty('type');
			expect(schema).toHaveProperty('scope');
			expect(schema).toHaveProperty('max');
			expect(schema).toHaveProperty('initial');
			expect(schema).toHaveProperty('recoveries');
		});

		it('lets the generic spend row list the pool unless the rule says otherwise', () => {
			const field = ChargePoolRule.defineSchema().spentByFeaturesOnly as unknown as {
				initial: unknown;
				label: string;
			};
			expect(field.initial).toBe(false);
			expect(field.label).toBe('NIMBLE.rules.chargePool.spentByFeaturesOnly.label');
		});

		it('offers the healed trigger on a recovery', () => {
			expect(Object.keys(recoveryFields().trigger.choices ?? {})).toContain('onHealed');
		});

		it('gives each recovery an optional condition', () => {
			const predicate = recoveryFields().predicate;
			expect(predicate).toBeInstanceOf(PredicateField);
			expect(predicate.label).toBe('NIMBLE.rules.chargePool.recoveries.predicate.label');
			expect(predicate.hint).toBe('NIMBLE.rules.chargePool.recoveries.predicate.hint');
		});
	});

	describe('class metadata', () => {
		it('exposes the picker group and i18n description key', () => {
			expect(ChargePoolRule.group).toBe('resource');
			expect(ChargePoolRule.description).toBe('NIMBLE.rules.chargePool.description');
		});
	});

	describe('pack pool spent only by its features', () => {
		const path =
			'packs/classFeatures/core/commander/commander-progression/fit-for-any-battlefield.json';

		it('is set on the combat-dice pool', () => {
			const rules = readItem(path).system.rules as Array<Record<string, unknown>>;
			const pool = rules.find(
				(rule) => rule.type === 'chargePool' && rule.identifier === 'combat-dice',
			);
			expect(pool?.spentByFeaturesOnly).toBe(true);
		});

		it('passes the schema of each rule type', async () => {
			expect(await packRuleFailures(readItem(path))).toEqual([]);
		});
	});
});
