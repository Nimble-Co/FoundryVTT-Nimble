import { describe, expect, it } from 'vitest';
import { SavingThrowRollModeRule } from './savingThrowRollMode.js';

describe('SavingThrowRollModeRule', () => {
	describe('schema', () => {
		it('defines the expected fields', () => {
			const schema = SavingThrowRollModeRule.defineSchema();
			expect(schema).toHaveProperty('type');
			expect(schema).toHaveProperty('value');
			expect(schema).toHaveProperty('target');
			expect(schema).toHaveProperty('selectedSave');
			expect(schema).toHaveProperty('mode');
			expect(schema).toHaveProperty('requiresChoice');
		});

		it('declares the closed mode choice set', () => {
			const schema = SavingThrowRollModeRule.defineSchema();
			const mode = schema.mode as unknown as { choices: string[] };
			expect(mode.choices).toEqual(['set', 'adjust']);
		});
	});

	describe('class metadata', () => {
		it('exposes the picker group and i18n description key', () => {
			expect(SavingThrowRollModeRule.group).toBe('bonuses');
			expect(SavingThrowRollModeRule.description).toBe(
				'NIMBLE.ruleDescriptions.savingThrowRollMode',
			);
		});
	});
});
