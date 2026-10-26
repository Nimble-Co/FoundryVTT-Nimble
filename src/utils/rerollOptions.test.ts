import { describe, expect, it } from 'vitest';
import { prepareReroll } from './rerollOptions.js';

describe('prepareReroll', () => {
	it('drops the set primary die value and computed values', () => {
		const { options } = prepareReroll('1d8', {
			rollMode: -1,
			rollModeSources: [0, -1],
			netRollMode: -1,
			primaryDieValue: 3,
			primaryDieModifier: 2,
			primaryDieBaseResult: 4,
			canCrit: true,
		});

		expect(options).toEqual({
			rollMode: -1,
			rollModeSources: [0, -1],
			primaryDieModifier: 2,
			canCrit: true,
		});
	});

	it('does not change the options it is given', () => {
		const source = { primaryDieValue: 3, primaryDieModifier: 1 };

		prepareReroll('1d8', source, { primaryDieBonus: 1 });

		expect(source).toEqual({ primaryDieValue: 3, primaryDieModifier: 1 });
	});

	it('returns empty options for missing options', () => {
		expect(prepareReroll('1d8', undefined).options).toEqual({});
	});

	it('keeps the formula and drops results when there are no changes', () => {
		expect(prepareReroll('1d8 + 2', { primaryDieValue: 5, rollMode: 1 })).toEqual({
			formula: '1d8 + 2',
			options: { rollMode: 1 },
		});
	});

	it('adds the roll mode change to the first roll sources', () => {
		const { options } = prepareReroll(
			'1d8',
			{ rollMode: 1, rollModeSources: [1, -1], netRollMode: 0 },
			{ rollModeChange: -1 },
		);
		expect(options.rollModeSources).toEqual([1, -1, -1]);
		expect(options).not.toHaveProperty('netRollMode');
	});

	it('starts the sources from the roll mode when the first roll had none', () => {
		const { options } = prepareReroll('1d8', { rollMode: 1 }, { rollModeChange: 1 });
		expect(options.rollModeSources).toEqual([1, 1]);
	});

	it('adds to the primary die modifier the first roll had', () => {
		const { options } = prepareReroll(
			'1d8',
			{ primaryDieModifier: 2, primaryDieValue: 8 },
			{ primaryDieBonus: 1 },
		);
		expect(options.primaryDieModifier).toBe(3);
		expect(options).not.toHaveProperty('primaryDieValue');
	});

	it('adds the extra damage to the formula', () => {
		expect(prepareReroll('1d8 + 2', {}, { extraDamage: ' 1d6 ' }).formula).toBe('1d8 + 2 + (1d6)');
	});

	it('ignores an empty extra damage and a zero change', () => {
		expect(
			prepareReroll(
				'1d8',
				{ rollMode: 0 },
				{ extraDamage: '  ', rollModeChange: 0, primaryDieBonus: 0 },
			),
		).toEqual({ formula: '1d8', options: { rollMode: 0 } });
	});
});
