import { describe, expect, it } from 'vitest';
import { RemoveSpellsRule } from './removeSpells.js';

describe('RemoveSpellsRule', () => {
	describe('schema', () => {
		it('defines the expected fields', () => {
			const schema = RemoveSpellsRule.defineSchema();
			expect(schema).toHaveProperty('type');
			expect(schema).toHaveProperty('uuids');
		});

		it('defaults type to removeSpells', () => {
			const schema = RemoveSpellsRule.defineSchema();
			const type = schema.type as unknown as { initial: string };
			expect(type.initial).toBe('removeSpells');
		});

		it('defaults uuids to an empty array', () => {
			const schema = RemoveSpellsRule.defineSchema();
			const uuids = schema.uuids as unknown as { initial: string[] };
			expect(uuids.initial).toEqual([]);
		});
	});

	describe('class metadata', () => {
		it('exposes the picker group and i18n description key', () => {
			expect(RemoveSpellsRule.group).toBe('grants');
			expect(RemoveSpellsRule.description).toBe('NIMBLE.rules.removeSpells.description');
		});
	});
});
