import { describe, expect, it } from 'vitest';
import shouldFlashDroppedItem from './shouldFlashDroppedItem.js';

describe('shouldFlashDroppedItem', () => {
	it('returns true when the item id exists in the flash id set', () => {
		const droppedItemFlashIds = new Set(['item-1', 'item-2']);

		expect(shouldFlashDroppedItem(droppedItemFlashIds, 'item-2')).toBe(true);
	});

	it('returns false when the item id does not exist in the flash id set', () => {
		const droppedItemFlashIds = new Set(['item-1']);

		expect(shouldFlashDroppedItem(droppedItemFlashIds, 'item-2')).toBe(false);
	});

	it('returns false for null or undefined item ids', () => {
		const droppedItemFlashIds = new Set(['item-1']);

		expect(shouldFlashDroppedItem(droppedItemFlashIds, null)).toBe(false);
		expect(shouldFlashDroppedItem(droppedItemFlashIds, undefined)).toBe(false);
	});
});
