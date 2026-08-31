import { describe, expect, it } from 'vitest';

import {
	addVariant,
	canonicalVariant,
	effectiveVariants,
	offersVariantChoice,
	removeVariant,
	variantIcon,
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

describe('canonicalVariant', () => {
	it('returns the name as the ancestry spelled it', () => {
		expect(canonicalVariant(['Dryad', 'Shroomling'], 'Shroomling')).toBe('Shroomling');
	});

	it("returns the ancestry's own spelling, whatever casing or padding was asked for", () => {
		expect(canonicalVariant(['Dryad', 'Shroomling'], 'shroomling')).toBe('Shroomling');
		expect(canonicalVariant(['Dryad', 'Shroomling'], '  DRYAD  ')).toBe('Dryad');
	});

	it('returns null for a name the ancestry does not offer', () => {
		expect(canonicalVariant(['Dryad'], 'Oozeling')).toBeNull();
		expect(canonicalVariant([], 'Dryad')).toBeNull();
		expect(canonicalVariant(['Dryad'], '   ')).toBeNull();
		expect(canonicalVariant(['Dryad'], '')).toBeNull();
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

	it('removes by the same case-insensitive comparison the list dedupes with', () => {
		expect(removeVariant(['Dryad', 'Shroomling'], 'dryad')).toEqual(['Shroomling']);
	});
});

describe('variantIcon', () => {
	it('gives a name an icon of what kind of people it is, however the name was typed', () => {
		expect(variantIcon('Shroomling')).toBe('fa-solid fa-mushroom');
		expect(variantIcon(' shroomling ')).toBe('fa-solid fa-mushroom');
	});

	it('falls back to a neutral icon for a name no icon has been drawn for', () => {
		expect(variantIcon('Sporeling')).toBe('fa-solid fa-user');
	});
});
