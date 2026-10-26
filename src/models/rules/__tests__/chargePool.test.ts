import { describe, expect, it } from 'vitest';
import { PredicateField } from '../../fields/PredicateField.js';
import { ChargePoolRule } from '../chargePool.js';

type RecoveryFields = Record<string, { choices?: string[]; label?: string; hint?: string }>;

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

		it('offers the healed trigger on a recovery', () => {
			expect(recoveryFields().trigger.choices).toContain('onHealed');
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
});
