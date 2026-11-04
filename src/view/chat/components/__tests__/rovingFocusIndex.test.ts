import { describe, expect, it } from 'vitest';
import { rovingFocusIndex } from '../rovingFocusIndex.ts';

describe('rovingFocusIndex', () => {
	it('moves down and up on the vertical axis, and wraps at each end', () => {
		expect(rovingFocusIndex('ArrowDown', 0, 2, 'vertical')).toBe(1);
		expect(rovingFocusIndex('ArrowDown', 2, 2, 'vertical')).toBe(0);
		expect(rovingFocusIndex('ArrowUp', 1, 2, 'vertical')).toBe(0);
		expect(rovingFocusIndex('ArrowUp', 0, 2, 'vertical')).toBe(2);
	});

	it('moves right and left on the horizontal axis, and wraps at each end', () => {
		expect(rovingFocusIndex('ArrowRight', 1, 2, 'horizontal')).toBe(2);
		expect(rovingFocusIndex('ArrowRight', 2, 2, 'horizontal')).toBe(0);
		expect(rovingFocusIndex('ArrowLeft', 2, 2, 'horizontal')).toBe(1);
		expect(rovingFocusIndex('ArrowLeft', 0, 2, 'horizontal')).toBe(2);
	});

	it('ignores the arrows of the other axis', () => {
		expect(rovingFocusIndex('ArrowLeft', 1, 2, 'vertical')).toBeUndefined();
		expect(rovingFocusIndex('ArrowRight', 1, 2, 'vertical')).toBeUndefined();
		expect(rovingFocusIndex('ArrowUp', 1, 2, 'horizontal')).toBeUndefined();
		expect(rovingFocusIndex('ArrowDown', 1, 2, 'horizontal')).toBeUndefined();
	});

	it('uses all four arrows on both axes', () => {
		expect(rovingFocusIndex('ArrowDown', 0, 2, 'both')).toBe(1);
		expect(rovingFocusIndex('ArrowRight', 0, 2, 'both')).toBe(1);
		expect(rovingFocusIndex('ArrowUp', 0, 2, 'both')).toBe(2);
		expect(rovingFocusIndex('ArrowLeft', 0, 2, 'both')).toBe(2);
	});

	it('goes to the first and the last button on Home and End', () => {
		expect(rovingFocusIndex('Home', 1, 2, 'vertical')).toBe(0);
		expect(rovingFocusIndex('End', 1, 2, 'horizontal')).toBe(2);
	});

	it('goes to the first or the last button from no button', () => {
		expect(rovingFocusIndex('ArrowDown', -1, 2, 'vertical')).toBe(0);
		expect(rovingFocusIndex('ArrowUp', -1, 2, 'vertical')).toBe(2);
	});

	it('gives undefined for any other key', () => {
		expect(rovingFocusIndex('Enter', 1, 2, 'both')).toBeUndefined();
		expect(rovingFocusIndex('Escape', 1, 2, 'both')).toBeUndefined();
	});
});
