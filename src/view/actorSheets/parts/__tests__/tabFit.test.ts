import { describe, expect, it } from 'vitest';
import { tabFit } from '../tabFit.ts';

describe('tabFit', () => {
	it('puts the label beside the icon when a slot is wide', () => {
		expect(tabFit(700, 8)).toBe('inline');
	});

	it('keeps a label under the icon on a phone, so a tab never needs hover to read', () => {
		expect(tabFit(386, 8)).toBe('stacked');
		expect(tabFit(340, 8)).toBe('stacked');
	});

	it('shows only the icon when even a short label cannot fit', () => {
		expect(tabFit(320, 8)).toBe('icon');
	});
});
