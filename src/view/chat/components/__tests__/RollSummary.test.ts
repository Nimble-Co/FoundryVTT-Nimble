import { describe, expect, it } from 'vitest';

import { getPrimaryDieBreakdown } from '../RollSummary.svelte.ts';

function options(
	rollOptions: Record<string, unknown>,
	faces: number | null = 6,
	primaryDieBonuses: { label: string; value: number }[] = [],
) {
	return { rollOptions, roll: { terms: faces ? [{ faces }] : [] }, primaryDieBonuses };
}

describe('getPrimaryDieBreakdown', () => {
	it('returns null when no number was added to the primary die', () => {
		expect(getPrimaryDieBreakdown(options({ primaryDieModifier: 0 }))).toBeNull();
		expect(getPrimaryDieBreakdown(undefined)).toBeNull();
	});

	it('returns null when the face before the number is not known', () => {
		expect(getPrimaryDieBreakdown(options({ primaryDieModifier: 2 }))).toBeNull();
	});

	it('shows the face, the number and the result, and names who added it', () => {
		expect(
			getPrimaryDieBreakdown(
				options({ primaryDieModifier: 1, primaryDieBaseResult: 5 }, 6, [
					{ label: 'Unerring Judgment', value: 1 },
				]),
			),
		).toEqual({ text: 'Primary Die: 5 + 1 = 6', tooltip: 'Unerring Judgment +1' });
	});

	it('names the part no feature added as the attack dialog', () => {
		expect(
			getPrimaryDieBreakdown(options({ primaryDieModifier: 1, primaryDieBaseResult: 2 }))?.tooltip,
		).toBe('Add to Primary Die Result +1');
	});

	it('stops at the max: the part past it is lost', () => {
		expect(
			getPrimaryDieBreakdown(options({ primaryDieModifier: 1, primaryDieBaseResult: 6 }))?.text,
		).toBe('Primary Die: 6 + 1 = 6, the max');
	});

	it('stops at 1 with a negative number', () => {
		expect(
			getPrimaryDieBreakdown(options({ primaryDieModifier: -2, primaryDieBaseResult: 2 }))?.text,
		).toBe('Primary Die: 2 - 2 = 1, the lowest');
		expect(
			getPrimaryDieBreakdown(options({ primaryDieModifier: -2, primaryDieBaseResult: 5 }))?.text,
		).toBe('Primary Die: 5 - 2 = 3');
	});

	it('does not stop at a max when the die size is not known', () => {
		expect(
			getPrimaryDieBreakdown(options({ primaryDieModifier: 5, primaryDieBaseResult: 4 }, null))
				?.text,
		).toBe('Primary Die: 4 + 5 = 9');
	});
});
