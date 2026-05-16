import { describe, expect, it } from 'vitest';
import { NimbleBaseRule } from './base.js';

describe('NimbleBaseRule', () => {
	describe('schema', () => {
		it('defines the expected base fields inherited by every rule', () => {
			const schema = NimbleBaseRule.defineSchema();

			expect(schema).toHaveProperty('disabled');
			expect(schema).toHaveProperty('id');
			expect(schema).toHaveProperty('identifier');
			expect(schema).toHaveProperty('label');
			expect(schema).toHaveProperty('predicate');
			expect(schema).toHaveProperty('priority');
		});
	});

	describe('class-level metadata', () => {
		it('defaults `group` to "unsorted" so the picker can flag unconfigured rules', () => {
			expect(NimbleBaseRule.group).toBe('unsorted');
		});

		it('defaults `description` to "" so the picker can flag missing copy', () => {
			expect(NimbleBaseRule.description).toBe('');
		});
	});
});
