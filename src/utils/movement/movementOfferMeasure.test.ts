import { describe, expect, it } from 'vitest';
import { movementOfferMeasure } from './movementOfferMeasure.js';

describe('movementOfferMeasure', () => {
	it('counts a Free Move that honours difficult terrain by cost', () => {
		expect(movementOfferMeasure({ kind: 'free', ignoreDifficultTerrain: false })).toBe('cost');
	});

	it('counts a Free Move that ignores difficult terrain by distance', () => {
		expect(movementOfferMeasure({ kind: 'free', ignoreDifficultTerrain: true })).toBe('distance');
	});

	it('counts Forced Movement by distance, whatever its terrain clause holds', () => {
		expect(movementOfferMeasure({ kind: 'forced', ignoreDifficultTerrain: true })).toBe('distance');
		expect(movementOfferMeasure({ kind: 'forced', ignoreDifficultTerrain: false })).toBe(
			'distance',
		);
	});
});
