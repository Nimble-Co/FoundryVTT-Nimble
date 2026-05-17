import { describe, expect, it } from 'vitest';
import { Predicate } from './Predicate.js';

describe('Predicate', () => {
	describe('presence-check (boolean true)', () => {
		it('should pass when the full key exists in the domain', () => {
			const predicate = new Predicate({ 'self:bloodied': true });
			expect(predicate.test(new Set(['self:bloodied']))).toBe(true);
		});

		it('should fail when the full key is absent from the domain', () => {
			const predicate = new Predicate({ 'self:bloodied': true });
			expect(predicate.test(new Set(['self:fullHp']))).toBe(false);
		});

		it('should support AND composition with multiple presence-checks', () => {
			const predicate = new Predicate({
				'self:bloodied': true,
				'self:concentrating': true,
			});

			// Both present — pass
			expect(predicate.test(new Set(['self:bloodied', 'self:concentrating']))).toBe(true);

			// Only one present — fail
			expect(predicate.test(new Set(['self:bloodied']))).toBe(false);
			expect(predicate.test(new Set(['self:concentrating']))).toBe(false);

			// Neither present — fail
			expect(predicate.test(new Set([]))).toBe(false);
		});

		it('should mix presence-check with atomic operation', () => {
			const predicate = new Predicate({
				'self:bloodied': true,
				armor: 'unarmored',
			});

			expect(predicate.test(new Set(['self:bloodied', 'armor:unarmored']))).toBe(true);
			expect(predicate.test(new Set(['self:bloodied', 'armor:equipped']))).toBe(false);
			expect(predicate.test(new Set(['armor:unarmored']))).toBe(false);
		});

		it('should treat empty predicate as always passing', () => {
			const predicate = new Predicate({});
			expect(predicate.test(new Set(['self:bloodied']))).toBe(true);
			expect(predicate.test(new Set([]))).toBe(true);
		});
	});

	describe('isStatement', () => {
		it('should accept boolean true as a valid statement', () => {
			expect(Predicate.isStatement(true)).toBe(true);
		});

		it('should reject boolean false', () => {
			expect(Predicate.isStatement(false)).toBe(false);
		});
	});
});
