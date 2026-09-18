import { describe, expect, it } from 'vitest';
import { movementOfferConstraints } from './movementOfferConstraints.js';

const forced = { kind: 'forced' as const, spaces: 2, ignoreDifficultTerrain: true };
const freeOverTerrain = { kind: 'free' as const, spaces: 3, ignoreDifficultTerrain: false };
const freeIgnoringTerrain = { kind: 'free' as const, spaces: 3, ignoreDifficultTerrain: true };

describe('movementOfferConstraints', () => {
	it('caps a push by distance, in scene units', () => {
		expect(movementOfferConstraints(forced, 5, null)).toEqual({ maxDistance: 10 });
	});

	it('caps a free move that honours terrain by cost instead', () => {
		expect(movementOfferConstraints(freeOverTerrain, 5, null)).toEqual({ maxCost: 15 });
	});

	it('caps a free move that ignores terrain by distance', () => {
		expect(movementOfferConstraints(freeIgnoringTerrain, 5, null)).toEqual({ maxDistance: 15 });
	});

	it('adds what the token already moved, because a drop is measured with the history', () => {
		expect(movementOfferConstraints(forced, 5, { distance: 20, cost: 35 })).toEqual({
			maxDistance: 30,
		});
		expect(movementOfferConstraints(freeOverTerrain, 5, { distance: 20, cost: 35 })).toEqual({
			maxCost: 50,
		});
	});

	it('never offers a negative limit', () => {
		expect(movementOfferConstraints({ ...forced, spaces: -2 }, 5, null)).toEqual({
			maxDistance: 0,
		});
	});
});
