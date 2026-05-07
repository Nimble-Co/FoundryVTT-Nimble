import { describe, expect, it } from 'vitest';
import { InitiativeRollModeRule } from './initiativeRollMode.js';

describe('InitiativeRollModeRule', () => {
	describe('schema', () => {
		it('defines the expected fields', () => {
			const schema = InitiativeRollModeRule.defineSchema();
			expect(schema).toHaveProperty('type');
			expect(schema).toHaveProperty('value');
			expect(schema).toHaveProperty('mode');
		});

		it('declares the closed mode choice set', () => {
			const schema = InitiativeRollModeRule.defineSchema();
			const mode = schema.mode as { choices: string[] };
			expect(mode.choices).toEqual(['set', 'adjust']);
		});
	});

	describe('class metadata', () => {
		it('exposes the picker group and i18n description key', () => {
			expect(InitiativeRollModeRule.group).toBe('bonuses');
			expect(InitiativeRollModeRule.description).toBe('NIMBLE.ruleDescriptions.initiativeRollMode');
		});
	});
});
