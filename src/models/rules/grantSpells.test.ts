import { describe, expect, it } from 'vitest';
import { GrantSpellsRule } from './grantSpells.js';

describe('GrantSpellsRule', () => {
	describe('schema', () => {
		it('defines the expected fields', () => {
			const schema = GrantSpellsRule.defineSchema();
			expect(schema).toHaveProperty('type');
			expect(schema).toHaveProperty('schools');
			expect(schema).toHaveProperty('tiers');
			expect(schema).toHaveProperty('utilityOnly');
			expect(schema).toHaveProperty('uuids');
			expect(schema).toHaveProperty('mode');
			expect(schema).toHaveProperty('count');
		});

		it('declares choices on schools array (with `known` sentinel)', () => {
			const schema = GrantSpellsRule.defineSchema();
			const schoolsArray = schema.schools as { element: { choices: () => string[] } };
			const choices = schoolsArray.element.choices();
			expect(choices).toContain('known');
			expect(choices).toContain('fire');
		});

		it('declares the closed mode choice set', () => {
			const schema = GrantSpellsRule.defineSchema();
			const mode = schema.mode as { choices: string[] };
			expect(mode.choices).toEqual(['auto', 'selectSchool', 'selectSpell']);
		});
	});

	describe('class metadata', () => {
		it('exposes the picker group and i18n description key', () => {
			expect(GrantSpellsRule.group).toBe('grants');
			expect(GrantSpellsRule.description).toBe('NIMBLE.ruleDescriptions.grantSpells');
		});
	});
});
