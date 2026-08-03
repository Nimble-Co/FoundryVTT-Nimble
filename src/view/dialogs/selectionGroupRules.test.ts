import { describe, expect, it } from 'vitest';

import type { NimbleFeatureItem } from '#documents/item/feature.js';
import {
	isFixedGroup,
	isGroupComplete,
	isRangeGroup,
	pickPreselection,
} from './selectionGroupRules.ts';

function feature(uuid: string): NimbleFeatureItem {
	return { uuid } as NimbleFeatureItem;
}

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

	it('is not a range when the maximum merely restates the required count', () => {
		expect(isRangeGroup({ selectionCount: 2, selectionMax: 2 })).toBe(false);
	});
});

describe('pickPreselection', () => {
	const cluster = [feature('Item.world-copy'), feature('Compendium.pack.Item.original')];

	it('starts on the recommended copy when one copy has to be kept', () => {
		expect(
			pickPreselection({
				features: cluster,
				selectionCount: 1,
				selectionMax: 2,
				recommendedUuid: 'Compendium.pack.Item.original',
			})?.uuid,
		).toBe('Compendium.pack.Item.original');
	});

	it('starts empty when keeping nothing is allowed, so the owned copy can stand alone', () => {
		expect(
			pickPreselection({
				features: cluster,
				selectionCount: 0,
				selectionMax: 1,
				ownedUuids: new Set(['Item.world-copy']),
				recommendedUuid: 'Compendium.pack.Item.original',
			}),
		).toBeUndefined();
	});

	it('preselects nothing for an ordinary group, which names no recommendation', () => {
		expect(pickPreselection({ features: cluster, selectionCount: 1 })).toBeUndefined();
	});

	it('preselects nothing when the recommended copy is no longer among the candidates', () => {
		expect(
			pickPreselection({ features: cluster, selectionCount: 1, recommendedUuid: 'Item.gone' }),
		).toBeUndefined();
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
