import { describe, expect, it } from 'vitest';

import {
	DEFAULT_SIZE,
	effectiveSizes,
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

	it('reverts to the default when the last size is removed', () => {
		expect(toggleSize(['large'], 'large', SIZE_ORDER)).toEqual([DEFAULT_SIZE]);
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

	it('falls back to the default when every size is already selected', () => {
		expect(toggleAllSizes([...SIZE_ORDER], SIZE_ORDER)).toEqual([DEFAULT_SIZE]);
	});

	it('treats a superset containing an unknown size as all selected', () => {
		expect(toggleAllSizes([...SIZE_ORDER, 'colossal'], SIZE_ORDER)).toEqual([DEFAULT_SIZE]);
	});
});
