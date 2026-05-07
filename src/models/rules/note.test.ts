import { describe, expect, it } from 'vitest';
import { NoteRule } from './note.js';

describe('NoteRule', () => {
	describe('schema', () => {
		it('defines the expected fields', () => {
			const schema = NoteRule.defineSchema();
			expect(schema).toHaveProperty('type');
			expect(schema).toHaveProperty('description');
			expect(schema).toHaveProperty('target');
			expect(schema).toHaveProperty('title');
			expect(schema).toHaveProperty('visibility');
		});

		it('declares the closed visibility choice set', () => {
			const schema = NoteRule.defineSchema();
			const visibility = schema.visibility as { choices: string[] };
			expect(visibility.choices).toEqual(['all', 'gmOnly', 'owner']);
		});
	});

	describe('class metadata', () => {
		it('exposes the picker group and i18n description key', () => {
			expect(NoteRule.group).toBe('notes');
			expect(NoteRule.description).toBe('NIMBLE.ruleDescriptions.note');
		});
	});
});
