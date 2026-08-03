import { describe, expect, it } from 'vitest';

import type { NimbleFeatureItem } from '#documents/item/feature.js';
import {
	getEffectiveSelectionMax,
	isFixedGroup,
	isGroupComplete,
	isRangeGroup,
} from './selectionGroupRules.ts';

function feature(uuid: string): NimbleFeatureItem {
	return { uuid } as NimbleFeatureItem;
}

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

describe('isFixedGroup', () => {
	it('is fixed when the options exactly match the required count', () => {
		expect(isFixedGroup({ features: [feature('a'), feature('b')], selectionCount: 2 })).toBe(true);
	});

	it('is not fixed when there are more options than required', () => {
		expect(isFixedGroup({ features: [feature('a'), feature('b')], selectionCount: 1 })).toBe(false);
	});
});

describe('isRangeGroup', () => {
	it('is a range when more copies may be kept than are required', () => {
		expect(isRangeGroup({ selectionCount: 1, selectionMax: 2 })).toBe(true);
	});

	it('is not a range for an exact choice', () => {
		expect(isRangeGroup({ selectionCount: 1 })).toBe(false);
	});
});

describe('isGroupComplete', () => {
	it('is incomplete below the required count', () => {
		expect(isGroupComplete({ selectionCount: 2 }, [feature('a')])).toBe(false);
	});

	it('is complete at the required count', () => {
		expect(isGroupComplete({ selectionCount: 2 }, [feature('a'), feature('b')])).toBe(true);
	});

	it('stays complete above the required count, as range groups allow', () => {
		expect(isGroupComplete({ selectionCount: 1 }, [feature('a'), feature('b')])).toBe(true);
	});
});
