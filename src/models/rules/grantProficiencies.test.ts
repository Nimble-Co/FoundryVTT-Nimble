import { describe, expect, it } from 'vitest';
import { GrantProficiencyRule } from './grantProficiencies.js';

describe('GrantProficiencyRule', () => {
	describe('schema', () => {
		it('defines the expected fields', () => {
			const schema = GrantProficiencyRule.defineSchema();
			expect(schema).toHaveProperty('type');
			expect(schema).toHaveProperty('proficiencyType');
			expect(schema).toHaveProperty('values');
		});

		it('declares the closed proficiencyType choice set', () => {
			const schema = GrantProficiencyRule.defineSchema();
			const proficiencyType = schema.proficiencyType as unknown as { choices: string[] };
			expect(proficiencyType.choices).toEqual(['armor', 'languages', 'weapons']);
		});
	});

	describe('class metadata', () => {
		it('exposes the picker group and i18n description key', () => {
			expect(GrantProficiencyRule.group).toBe('grants');
			expect(GrantProficiencyRule.description).toBe('NIMBLE.rules.grantProficiency.description');
		});
	});
});
