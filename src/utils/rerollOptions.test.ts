import { describe, expect, it } from 'vitest';
import { rerollOptions } from './rerollOptions.js';

describe('rerollOptions', () => {
	it('drops the set primary die value and computed values', () => {
		const options = rerollOptions({
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
		const source = { primaryDieValue: 3 };

		rerollOptions(source);

		expect(source).toEqual({ primaryDieValue: 3 });
	});

	it('returns empty options for missing options', () => {
		expect(rerollOptions(undefined)).toEqual({});
	});
});
