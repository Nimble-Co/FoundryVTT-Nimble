import { describe, expect, it } from 'vitest';
import { ArmorClassRule } from './armorClass.js';

describe('ArmorClassRule', () => {
	describe('schema', () => {
		it('defines the expected fields', () => {
			const schema = ArmorClassRule.defineSchema();
			expect(schema).toHaveProperty('type');
			expect(schema).toHaveProperty('formula');
			expect(schema).toHaveProperty('mode');
		});

		it('declares the closed mode choice set', () => {
			const schema = ArmorClassRule.defineSchema();
			const mode = schema.mode as unknown as { choices: string[] };
			expect(mode.choices).toEqual(['add', 'multiply', 'override']);
		});
	});

	describe('class metadata', () => {
		it('exposes the picker group and i18n description key', () => {
			expect(ArmorClassRule.group).toBe('bonuses');
			expect(ArmorClassRule.description).toBe('NIMBLE.ruleDescriptions.armorClass');
		});
	});
});
