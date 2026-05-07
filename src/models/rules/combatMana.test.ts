import { describe, expect, it } from 'vitest';
import { CombatManaRule } from './combatMana.js';

describe('CombatManaRule', () => {
	describe('schema', () => {
		it('defines the expected fields', () => {
			const schema = CombatManaRule.defineSchema();
			expect(schema).toHaveProperty('type');
			expect(schema).toHaveProperty('formula');
			expect(schema).toHaveProperty('resource');
			expect(schema).toHaveProperty('trigger');
			expect(schema).toHaveProperty('clearOn');
		});
	});

	describe('class metadata', () => {
		it('exposes the picker group and i18n description key', () => {
			expect(CombatManaRule.group).toBe('resource');
			expect(CombatManaRule.description).toBe('NIMBLE.ruleDescriptions.combatMana');
		});
	});
});
