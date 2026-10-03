import { describe, expect, it } from 'vitest';

import { getPrimaryDieBreakdown } from './RollSummary.svelte.ts';

function options(rollOptions: Record<string, unknown>, faces: number | null = 6) {
	return { rollOptions, roll: { terms: faces ? [{ faces }] : [] } };
}

describe('getPrimaryDieBreakdown', () => {
	it('returns null when no number was added to the primary die', () => {
		expect(getPrimaryDieBreakdown(options({ primaryDieModifier: 0 }))).toBeNull();
		expect(getPrimaryDieBreakdown(undefined)).toBeNull();
	});

	it('returns null when the roll did not record the roll before the modifier', () => {
		expect(getPrimaryDieBreakdown(options({ primaryDieModifier: 2 }))).toBeNull();
	});

	it('shows the roll before and after the modifier', () => {
		expect(
			getPrimaryDieBreakdown(options({ primaryDieModifier: 1, primaryDieBaseResult: 1 })),
		).toBe('Primary Die: rolled 1, modifier +1, result 2');
	});

	it('shows a negative modifier with its sign', () => {
		expect(
			getPrimaryDieBreakdown(options({ primaryDieModifier: -2, primaryDieBaseResult: 5 })),
		).toBe('Primary Die: rolled 5, modifier -2, result 3');
	});

	it('caps the result at the die maximum and shows the rest as damage', () => {
		expect(
			getPrimaryDieBreakdown(options({ primaryDieModifier: 5, primaryDieBaseResult: 4 })),
		).toBe('Primary Die: rolled 4, modifier +5, result 6 (maximum), 3 added to damage');
	});

	it('does not cap the result when the die size is not known', () => {
		expect(
			getPrimaryDieBreakdown(options({ primaryDieModifier: 5, primaryDieBaseResult: 4 }, null)),
		).toBe('Primary Die: rolled 4, modifier +5, result 9');
	});
});
