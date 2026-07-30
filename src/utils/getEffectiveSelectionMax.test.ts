import { describe, expect, it } from 'vitest';

import getEffectiveSelectionMax from './getEffectiveSelectionMax.ts';

describe('getEffectiveSelectionMax', () => {
	it('falls back to the required count when no maximum is set', () => {
		expect(getEffectiveSelectionMax({ selectionCount: 2 })).toBe(2);
	});

	it('returns the maximum when it is higher than the required count', () => {
		expect(getEffectiveSelectionMax({ selectionCount: 1, selectionMax: 3 })).toBe(3);
	});

	it('returns an explicit maximum even when it equals the required count', () => {
		expect(getEffectiveSelectionMax({ selectionCount: 2, selectionMax: 2 })).toBe(2);
	});

	it('treats a zero maximum as set rather than missing', () => {
		expect(getEffectiveSelectionMax({ selectionCount: 1, selectionMax: 0 })).toBe(0);
	});
});
