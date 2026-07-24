import { describe, expect, it } from 'vitest';
import { Predicate } from './Predicate.js';

describe('Predicate.extractReferencedKeys', () => {
	it('collects top-level leaf keys of every statement form', () => {
		const keys = Predicate.extractReferencedKeys({
			self: 'bloodied',
			size: { min: 'small' },
			class: ['berserker', 'hunter'],
		});
		expect(keys).toEqual(new Set(['self', 'size', 'class']));
	});

	it('collects atom prefixes inside $and arrays', () => {
		const keys = Predicate.extractReferencedKeys({ $and: ['self:bloodied', 'strength:4'] });
		expect(keys).toEqual(new Set(['self', 'strength']));
	});

	it('recurses into nested sub-predicates inside $or arrays', () => {
		const keys = Predicate.extractReferencedKeys({
			$or: ['minion', { dexterity: { min: 2 } }],
		});
		expect(keys).toEqual(new Set(['minion', 'dexterity']));
	});

	it('mixes top-level leaves with logical operators', () => {
		const keys = Predicate.extractReferencedKeys({
			self: 'fullHp',
			$and: ['intelligence:3'],
		});
		expect(keys).toEqual(new Set(['self', 'intelligence']));
	});

	it('returns an empty set for an empty predicate', () => {
		expect(Predicate.extractReferencedKeys({})).toEqual(new Set());
	});

	it('tolerates a malformed non-array logical value', () => {
		const keys = Predicate.extractReferencedKeys({
			$and: 'self:bloodied' as unknown as [],
			self: 'dying',
		});
		expect(keys).toEqual(new Set(['self']));
	});
});

describe('Predicate', () => {
	describe('empty predicate', () => {
		it('should always pass with an empty source', () => {
			const predicate = new Predicate({});
			expect(predicate.test(new Set(['self:bloodied']))).toBe(true);
			expect(predicate.test(new Set([]))).toBe(true);
		});
	});

	describe('atomic operation (key:value)', () => {
		it('should pass when the key:value exists in the domain', () => {
			const predicate = new Predicate({ armor: 'unarmored' });
			expect(predicate.test(new Set(['armor:unarmored']))).toBe(true);
		});

		it('should fail when the key:value is missing', () => {
			const predicate = new Predicate({ armor: 'unarmored' });
			expect(predicate.test(new Set(['armor:equipped']))).toBe(false);
		});
	});

	describe('binary operation (min / max / equal)', () => {
		describe('numeric min', () => {
			it('should pass when the matched value meets the minimum', () => {
				const predicate = new Predicate({ foo: { min: 2 } });
				expect(predicate.test(new Set(['foo:3']))).toBe(true);
			});

			it('should fail when the matched value is below the minimum', () => {
				const predicate = new Predicate({ foo: { min: 2 } });
				expect(predicate.test(new Set(['foo:1']))).toBe(false);
			});

			it('should fail when no matching tag exists in the domain', () => {
				// Regression: an absent tag must not vacuously satisfy min.
				const predicate = new Predicate({ alliesAdjacent: { min: 1 } });
				expect(predicate.test(new Set(['self:bloodied']))).toBe(false);
				expect(predicate.test(new Set([]))).toBe(false);
			});
		});

		describe('numeric max', () => {
			it('should pass when the matched value is within the maximum', () => {
				const predicate = new Predicate({ foo: { max: 2 } });
				expect(predicate.test(new Set(['foo:2']))).toBe(true);
			});

			it('should fail when the matched value exceeds the maximum', () => {
				const predicate = new Predicate({ foo: { max: 2 } });
				expect(predicate.test(new Set(['foo:3']))).toBe(false);
			});

			it('should fail when no matching tag exists in the domain', () => {
				const predicate = new Predicate({ foo: { max: 2 } });
				expect(predicate.test(new Set(['bar:1']))).toBe(false);
			});
		});

		describe('combined min and max', () => {
			it('should pass when the matched value is within both bounds', () => {
				const predicate = new Predicate({ foo: { min: 1, max: 3 } });
				expect(predicate.test(new Set(['foo:2']))).toBe(true);
			});

			it('should fail when the matched value is outside either bound', () => {
				const predicate = new Predicate({ foo: { min: 1, max: 3 } });
				expect(predicate.test(new Set(['foo:0']))).toBe(false);
				expect(predicate.test(new Set(['foo:4']))).toBe(false);
			});

			it('should fail when no matching tag exists in the domain', () => {
				const predicate = new Predicate({ foo: { min: 1, max: 3 } });
				expect(predicate.test(new Set([]))).toBe(false);
			});
		});

		describe('equal', () => {
			it('should pass when the exact key:value exists in the domain', () => {
				const predicate = new Predicate({ foo: { equal: 2 } });
				expect(predicate.test(new Set(['foo:2']))).toBe(true);
			});

			it('should fail when the exact key:value is absent', () => {
				const predicate = new Predicate({ foo: { equal: 2 } });
				expect(predicate.test(new Set(['foo:3']))).toBe(false);
				expect(predicate.test(new Set([]))).toBe(false);
			});
		});

		describe('non-numeric qualifier tags alongside numeric tags', () => {
			it('should ignore a non-numeric qualifier when checking min', () => {
				const predicate = new Predicate({ enemiesAdjacent: { min: 2 } });
				expect(predicate.test(new Set(['enemiesAdjacent:2', 'enemiesAdjacent:most']))).toBe(true);
			});

			it('should ignore a non-numeric qualifier when checking max', () => {
				const predicate = new Predicate({ enemiesAdjacent: { max: 1 } });
				expect(predicate.test(new Set(['enemiesAdjacent:2', 'enemiesAdjacent:most']))).toBe(false);
				expect(predicate.test(new Set(['enemiesAdjacent:1', 'enemiesAdjacent:most']))).toBe(true);
			});

			it('should fail min when only non-numeric qualifier tags match the key', () => {
				const predicate = new Predicate({ enemiesAdjacent: { min: 1 } });
				expect(predicate.test(new Set(['enemiesAdjacent:most']))).toBe(false);
			});
		});

		describe('string min/max via config mapping (size)', () => {
			it('should pass when the mapped domain value meets the string minimum', () => {
				const predicate = new Predicate({ size: { min: 'small' } });
				expect(predicate.test(new Set(['size:medium']))).toBe(true);
			});

			it('should fail when the mapped domain value is below the string minimum', () => {
				const predicate = new Predicate({ size: { min: 'large' } });
				expect(predicate.test(new Set(['size:medium']))).toBe(false);
			});

			it('should pass when the mapped domain value is within the string maximum', () => {
				const predicate = new Predicate({ size: { max: 'large' } });
				expect(predicate.test(new Set(['size:medium']))).toBe(true);
			});

			it('should fail when the mapped domain value exceeds the string maximum', () => {
				const predicate = new Predicate({ size: { max: 'small' } });
				expect(predicate.test(new Set(['size:huge']))).toBe(false);
			});

			it('should fail string min when no size tag exists in the domain', () => {
				const predicate = new Predicate({ size: { min: 'small' } });
				expect(predicate.test(new Set(['self:bloodied']))).toBe(false);
			});
		});
	});

	describe('logical composition ($and / $or)', () => {
		describe('$and with atom strings', () => {
			it('should pass when every atom is present in the domain', () => {
				const predicate = new Predicate({
					$and: ['self:raging', 'self:bloodied'],
				});

				expect(predicate.test(new Set(['self:raging', 'self:bloodied']))).toBe(true);
				expect(predicate.test(new Set(['self:raging']))).toBe(false);
				expect(predicate.test(new Set(['self:bloodied']))).toBe(false);
				expect(predicate.test(new Set([]))).toBe(false);
			});

			it('should treat empty $and as vacuously true', () => {
				expect(new Predicate({ $and: [] }).test(new Set(['anything']))).toBe(true);
			});
		});

		describe('$or with atom strings', () => {
			it('should pass when any atom is present in the domain', () => {
				const predicate = new Predicate({
					$or: ['self:bloodied', 'self:dying'],
				});

				expect(predicate.test(new Set(['self:bloodied']))).toBe(true);
				expect(predicate.test(new Set(['self:dying']))).toBe(true);
				expect(predicate.test(new Set(['self:bloodied', 'self:dying']))).toBe(true);
				expect(predicate.test(new Set(['self:fullHp']))).toBe(false);
			});

			it('should treat empty $or as vacuously false', () => {
				expect(new Predicate({ $or: [] }).test(new Set(['anything']))).toBe(false);
			});
		});

		describe('nested composition (sub-predicate objects)', () => {
			it('should support $and combined with a nested $or', () => {
				// Berserker: raging AND (bloodied OR dying)
				const predicate = new Predicate({
					$and: ['self:raging', { $or: ['self:bloodied', 'self:dying'] }],
				});

				expect(predicate.test(new Set(['self:raging', 'self:bloodied']))).toBe(true);
				expect(predicate.test(new Set(['self:raging', 'self:dying']))).toBe(true);
				expect(predicate.test(new Set(['self:bloodied', 'self:dying']))).toBe(false); // missing raging
				expect(predicate.test(new Set(['self:raging']))).toBe(false); // missing OR branch
			});

			it('should support $or-of-$ands', () => {
				const predicate = new Predicate({
					$or: [
						{ $and: ['self:raging', 'self:bloodied'] },
						{ $and: ['self:raging', 'self:dying'] },
					],
				});

				expect(predicate.test(new Set(['self:raging', 'self:bloodied']))).toBe(true);
				expect(predicate.test(new Set(['self:raging', 'self:dying']))).toBe(true);
				expect(predicate.test(new Set(['self:raging']))).toBe(false);
				expect(predicate.test(new Set(['self:bloodied']))).toBe(false);
			});

			it('should mix atom strings with object sub-predicates in the same array', () => {
				const predicate = new Predicate({
					$and: ['self:bloodied', { armor: 'unarmored' }],
				});

				expect(predicate.test(new Set(['self:bloodied', 'armor:unarmored']))).toBe(true);
				expect(predicate.test(new Set(['self:bloodied', 'armor:equipped']))).toBe(false);
				expect(predicate.test(new Set(['armor:unarmored']))).toBe(false);
			});
		});

		describe('top-level mixing with other leaf forms', () => {
			it('should AND a top-level atomic operation with a top-level $or', () => {
				const predicate = new Predicate({
					armor: 'unarmored',
					$or: ['self:bloodied', 'self:concentrating'],
				});

				expect(predicate.test(new Set(['armor:unarmored', 'self:bloodied']))).toBe(true);
				expect(predicate.test(new Set(['armor:unarmored', 'self:concentrating']))).toBe(true);
				expect(predicate.test(new Set(['armor:equipped', 'self:bloodied']))).toBe(false); // wrong armor
				expect(predicate.test(new Set(['armor:unarmored']))).toBe(false); // no OR branch
			});
		});

		describe('validation', () => {
			it('should reject $or with a non-array value', () => {
				expect(new Predicate({ $or: 'self:bloodied' } as never).isValid).toBe(false);
			});

			it('should reject $and containing a non-string, non-object element', () => {
				expect(new Predicate({ $and: [42] } as never).isValid).toBe(false);
			});

			it('should reject $and containing an empty atom string', () => {
				expect(new Predicate({ $and: [''] } as never).isValid).toBe(false);
			});

			it('should reject $or containing a sub-predicate with an invalid statement', () => {
				expect(new Predicate({ $or: [{ 'self:bloodied': true }] } as never).isValid).toBe(false);
			});

			it('should reject an empty sub-predicate inside $or (always-true footgun)', () => {
				// { "$or": [{}] } would otherwise evaluate as vacuously true and silently
				// make a bonus always apply — reject at construction.
				expect(new Predicate({ $or: [{}] } as never).isValid).toBe(false);
			});

			it('should reject an empty sub-predicate inside $and', () => {
				expect(new Predicate({ $and: [{}] } as never).isValid).toBe(false);
			});
		});

		describe('serialization', () => {
			it('should round-trip $and/$or through toObject() and clone()', () => {
				const predicate = new Predicate({
					$or: [
						{ $and: ['self:raging', 'self:bloodied'] },
						{ $and: ['self:raging', 'self:dying'] },
					],
				});
				const cloned = predicate.clone();

				expect(cloned.toObject()).toEqual({
					$or: [
						{ $and: ['self:raging', 'self:bloodied'] },
						{ $and: ['self:raging', 'self:dying'] },
					],
				});
				expect(cloned.test(new Set(['self:raging', 'self:bloodied']))).toBe(true);
				expect(cloned.test(new Set(['self:raging']))).toBe(false);
			});
		});
	});

	describe('isStatement', () => {
		it('should reject boolean values (no presence-check sentinel)', () => {
			expect(Predicate.isStatement(true)).toBe(false);
			expect(Predicate.isStatement(false)).toBe(false);
		});

		it('should accept atomic strings', () => {
			expect(Predicate.isStatement('bloodied')).toBe(true);
		});

		it('should reject empty strings', () => {
			expect(Predicate.isStatement('')).toBe(false);
		});
	});
});
