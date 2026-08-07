import { describe, expect, it } from 'vitest';
import { GrantActivationRule } from './grantActivation.js';

describe('GrantActivationRule', () => {
	describe('schema', () => {
		it('defines the expected fields', () => {
			const schema = GrantActivationRule.defineSchema();
			expect(schema).toHaveProperty('type');
			expect(schema).toHaveProperty('activationType');
		});

		it('declares a closed activation-type choice set defaulting to weaponAttack', () => {
			const schema = GrantActivationRule.defineSchema();
			const activationType = schema.activationType as unknown as {
				choices: string[];
				options: { initial: string };
			};
			expect(activationType.choices).toEqual(['weaponAttack']);
			expect(activationType.options.initial).toBe('weaponAttack');
		});
	});

	describe('class metadata', () => {
		it('exposes the picker group and i18n description key', () => {
			expect(GrantActivationRule.group).toBe('resource');
			expect(GrantActivationRule.description).toBe('NIMBLE.rules.grantActivation.description');
		});

		it('declares no lifecycle hooks', () => {
			// A pure offer descriptor must never run during data preparation.
			expect(GrantActivationRule.appliesInPrePrepareData).toBe(false);
			expect(Object.getOwnPropertyNames(GrantActivationRule.prototype)).not.toContain(
				'afterPrepareData',
			);
		});
	});
});
