import { describe, expect, it } from 'vitest';
import { poolHeading } from '../poolHeading.js';

describe('poolHeading', () => {
	it('puts the refill note of a pool label in the tooltip', () => {
		expect(poolHeading("Songweaver's Inspiration (2×WIL/Safe Rest)")).toEqual({
			name: "Songweaver's Inspiration",
			tooltip: "Songweaver's Inspiration (2×WIL/Safe Rest)",
		});
	});

	it('keeps a label with no note as it is, with no tooltip', () => {
		expect(poolHeading('Pilfered Power')).toEqual({ name: 'Pilfered Power', tooltip: null });
	});

	it('keeps brackets that are not at the end, and a label that is only a note', () => {
		expect(poolHeading('Fury (Rage) Dice')).toEqual({ name: 'Fury (Rage) Dice', tooltip: null });
		expect(poolHeading('(1/Safe Rest)')).toEqual({ name: '(1/Safe Rest)', tooltip: null });
	});
});
