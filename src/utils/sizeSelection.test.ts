import { describe, expect, it } from 'vitest';

import {
	DEFAULT_SIZE,
	effectiveSizes,
	offersSizeChoice,
	sortBySizeOrder,
	toggleAllSizes,
	toggleSize,
} from './sizeSelection.js';

const SIZE_ORDER = ['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan'];

describe('effectiveSizes', () => {
	it('returns the stored sizes in canonical order', () => {
		expect(effectiveSizes(['large', 'small'], SIZE_ORDER)).toEqual(['small', 'large']);
	});

	it('presents an unauthored ancestry as the default size', () => {
		expect(effectiveSizes([], SIZE_ORDER)).toEqual([DEFAULT_SIZE]);
		expect(effectiveSizes(undefined, SIZE_ORDER)).toEqual([DEFAULT_SIZE]);
		expect(effectiveSizes(null, SIZE_ORDER)).toEqual([DEFAULT_SIZE]);
	});

	it('deduplicates a size stored twice', () => {
		expect(effectiveSizes(['medium', 'medium', 'large'], SIZE_ORDER)).toEqual(['medium', 'large']);
	});

	it('does not mutate the stored array', () => {
		const stored = ['large', 'small'];

		effectiveSizes(stored, SIZE_ORDER);

		expect(stored).toEqual(['large', 'small']);
	});
});

describe('sortBySizeOrder', () => {
	it('sorts sizes smallest to largest', () => {
		expect(sortBySizeOrder(['gargantuan', 'tiny', 'medium'], SIZE_ORDER)).toEqual([
			'tiny',
			'medium',
			'gargantuan',
		]);
	});

	it('keeps sizes the config does not define rather than dropping them', () => {
		expect(sortBySizeOrder(['medium', 'colossal'], SIZE_ORDER)).toEqual(['colossal', 'medium']);
	});
});

describe('offersSizeChoice', () => {
	it('is true when two or more sizes are on offer', () => {
		expect(offersSizeChoice(['small', 'medium'], SIZE_ORDER)).toBe(true);
	});

	it('is false for a single size, an unauthored ancestry, or the same size stored twice', () => {
		expect(offersSizeChoice(['large'], SIZE_ORDER)).toBe(false);
		expect(offersSizeChoice([], SIZE_ORDER)).toBe(false);
		expect(offersSizeChoice(undefined, SIZE_ORDER)).toBe(false);
		expect(offersSizeChoice(['medium', 'medium'], SIZE_ORDER)).toBe(false);
	});
});

describe('toggleSize', () => {
	it('adds a size in canonical order regardless of click order', () => {
		expect(toggleSize(['large'], 'small', SIZE_ORDER)).toEqual(['small', 'large']);
	});

	it('removes a selected size', () => {
		expect(toggleSize(['small', 'medium', 'large'], 'medium', SIZE_ORDER)).toEqual([
			'small',
			'large',
		]);
	});

	it('restores the published size when the last size is removed', () => {
		expect(toggleSize(['huge'], 'huge', SIZE_ORDER, ['large'])).toEqual(['large']);
	});

	it('falls back to the default when the last size is removed and nothing was published', () => {
		expect(toggleSize(['large'], 'large', SIZE_ORDER)).toEqual([DEFAULT_SIZE]);
		expect(toggleSize(['large'], 'large', SIZE_ORDER, [])).toEqual([DEFAULT_SIZE]);
	});

	it('reverts to the default when the last size removed is the default itself', () => {
		expect(toggleSize([DEFAULT_SIZE], DEFAULT_SIZE, SIZE_ORDER)).toEqual([DEFAULT_SIZE]);
	});

	it('preserves a size the config does not define when toggling another', () => {
		expect(toggleSize(['colossal', 'medium'], 'large', SIZE_ORDER)).toEqual([
			'colossal',
			'medium',
			'large',
		]);
	});

	it('does not mutate the current selection', () => {
		const current = ['small'];

		toggleSize(current, 'large', SIZE_ORDER);

		expect(current).toEqual(['small']);
	});
});

describe('toggleAllSizes', () => {
	it('selects every size when only some are selected', () => {
		expect(toggleAllSizes(['medium'], SIZE_ORDER)).toEqual(SIZE_ORDER);
	});

	it('selects every size when none of them are selected', () => {
		expect(toggleAllSizes([], SIZE_ORDER)).toEqual(SIZE_ORDER);
	});

	it('restores the published size when every size is deselected', () => {
		expect(toggleAllSizes([...SIZE_ORDER], SIZE_ORDER, ['large'])).toEqual(['large']);
	});

	it('falls back to the default when every size is deselected and nothing was published', () => {
		expect(toggleAllSizes([...SIZE_ORDER], SIZE_ORDER)).toEqual([DEFAULT_SIZE]);
	});

	it('keeps a size the config does not define when selecting every size', () => {
		expect(toggleAllSizes(['colossal'], SIZE_ORDER)).toEqual(['colossal', ...SIZE_ORDER]);
	});

	it('keeps a size the config does not define when deselecting every size', () => {
		expect(toggleAllSizes([...SIZE_ORDER, 'colossal'], SIZE_ORDER)).toEqual(['colossal']);
	});
});
