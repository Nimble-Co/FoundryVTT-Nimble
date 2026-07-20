import { describe, expect, it } from 'vitest';
import { RestrictSpellSchoolsRule } from './restrictSpellSchools.js';

describe('RestrictSpellSchoolsRule', () => {
	describe('schema', () => {
		it('defines the expected fields', () => {
			const schema = RestrictSpellSchoolsRule.defineSchema();
			expect(schema).toHaveProperty('type');
			expect(schema).toHaveProperty('allowedSchools');
			expect(schema).toHaveProperty('exceptionFromSchools');
			expect(schema).toHaveProperty('exceptionCount');
		});

		it('defaults type to restrictSpellSchools', () => {
			const schema = RestrictSpellSchoolsRule.defineSchema();
			const type = schema.type as unknown as { initial: string };
			expect(type.initial).toBe('restrictSpellSchools');
		});

		it('declares spell-school choices on the school arrays', () => {
			const schema = RestrictSpellSchoolsRule.defineSchema();
			const allowed = schema.allowedSchools as unknown as {
				element: { choices: () => string[] };
			};
			const choices = allowed.element.choices();
			expect(choices).toContain('fire');
		});

		it('defaults exceptionCount to 1', () => {
			const schema = RestrictSpellSchoolsRule.defineSchema();
			const count = schema.exceptionCount as unknown as { initial: number };
			expect(count.initial).toBe(1);
		});
	});

	describe('class metadata', () => {
		it('exposes the picker group and i18n description key', () => {
			expect(RestrictSpellSchoolsRule.group).toBe('grants');
			expect(RestrictSpellSchoolsRule.description).toBe(
				'NIMBLE.rules.restrictSpellSchools.description',
			);
		});
	});
});
