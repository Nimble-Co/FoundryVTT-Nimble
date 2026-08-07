import { describe, expect, it } from 'vitest';

import {
	addVariant,
	effectiveVariants,
	isVariantOf,
	offersVariantChoice,
	removeVariant,
} from './ancestryVariants.js';

describe('effectiveVariants', () => {
	it('keeps the names in the order the GM authored them', () => {
		expect(effectiveVariants(['Dryad', 'Shroomling'])).toEqual(['Dryad', 'Shroomling']);
	});

	it('presents an ancestry with no authored variants as having none', () => {
		expect(effectiveVariants([])).toEqual([]);
		expect(effectiveVariants(undefined)).toEqual([]);
		expect(effectiveVariants(null)).toEqual([]);
	});

	it('returns a lone name so the sheet can show the first one added', () => {
		expect(effectiveVariants(['Dryad'])).toEqual(['Dryad']);
	});

	it('trims surrounding whitespace and drops blank entries', () => {
		expect(effectiveVariants([' Oozeling ', '', '   ', 'Construct'])).toEqual([
			'Oozeling',
			'Construct',
		]);
	});

	it('drops a repeat regardless of case, keeping the spelling authored first', () => {
		expect(effectiveVariants(['Minotaur', 'minotaur', 'Beastfolk'])).toEqual([
			'Minotaur',
			'Beastfolk',
		]);
	});

	it('does not mutate the stored array', () => {
		const stored = ['Dryad', 'Shroomling'];

		effectiveVariants(stored);

		expect(stored).toEqual(['Dryad', 'Shroomling']);
	});
});

describe('offersVariantChoice', () => {
	it('is true when two or more names are on offer', () => {
		expect(offersVariantChoice(['Dryad', 'Shroomling'])).toBe(true);
	});

	it('is false for a single name, no names, or the same name twice', () => {
		expect(offersVariantChoice(['Dryad'])).toBe(false);
		expect(offersVariantChoice([])).toBe(false);
		expect(offersVariantChoice(undefined)).toBe(false);
		expect(offersVariantChoice(['Dryad', 'dryad'])).toBe(false);
	});
});

describe('isVariantOf', () => {
	it('accepts a name the ancestry offers, ignoring surrounding whitespace', () => {
		expect(isVariantOf(['Dryad', 'Shroomling'], 'Shroomling')).toBe(true);
		expect(isVariantOf(['Dryad', 'Shroomling'], ' Shroomling ')).toBe(true);
	});

	it('rejects a name the ancestry does not offer', () => {
		expect(isVariantOf(['Dryad', 'Shroomling'], 'Oozeling')).toBe(false);
		expect(isVariantOf([], 'Dryad')).toBe(false);
		// Matching is exact once trimmed: a differently-cased name is not the authored one.
		expect(isVariantOf(['Dryad'], 'dryad')).toBe(false);
	});
});

describe('addVariant', () => {
	it('appends a name after the ones already listed', () => {
		expect(addVariant(['Dryad'], 'Shroomling')).toEqual(['Dryad', 'Shroomling']);
	});

	it('ignores a blank name', () => {
		expect(addVariant(['Dryad'], '   ')).toEqual(['Dryad']);
	});

	it('ignores a name already listed, whatever its case', () => {
		expect(addVariant(['Dryad', 'Shroomling'], 'dryad')).toEqual(['Dryad', 'Shroomling']);
	});

	it('does not mutate the current list', () => {
		const current = ['Dryad'];

		addVariant(current, 'Shroomling');

		expect(current).toEqual(['Dryad']);
	});
});

describe('removeVariant', () => {
	it('drops the named variant and keeps the rest in order', () => {
		expect(removeVariant(['Oozeling', 'Construct', 'Golem'], 'Construct')).toEqual([
			'Oozeling',
			'Golem',
		]);
	});

	it('empties the list when the last variant is removed', () => {
		// Unlike sizes, an ancestry needs no variants at all — most cover a single kind of people.
		expect(removeVariant(['Dryad'], 'Dryad')).toEqual([]);
	});

	it('leaves the list alone when the variant is not listed', () => {
		expect(removeVariant(['Dryad'], 'Shroomling')).toEqual(['Dryad']);
	});
});
