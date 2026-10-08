import { describe, expect, it } from 'vitest';
import { flattenLegacyCurrency } from './flattenLegacyCurrency.js';

describe('flattenLegacyCurrency', () => {
	it('turns a { label, value } entry into its amount', () => {
		const source = {
			currency: {
				cp: { label: 'NIMBLE.currencyAbbreviations.cp', value: 3 },
				sp: { label: 'NIMBLE.currencyAbbreviations.sp', value: 12 },
				gp: { label: 'NIMBLE.currencyAbbreviations.gp', value: 50 },
			},
		};

		flattenLegacyCurrency(source);

		expect(source.currency).toEqual({ cp: 3, sp: 12, gp: 50 });
	});

	it('leaves plain numbers as they are', () => {
		const source = { currency: { cp: 0, sp: 7, gp: 50 } };

		flattenLegacyCurrency(source);

		expect(source.currency).toEqual({ cp: 0, sp: 7, gp: 50 });
	});

	it('reads an entry without an amount as 0', () => {
		const source = { currency: { gp: { label: 'x' } } };

		flattenLegacyCurrency(source);

		expect(source.currency).toEqual({ gp: 0 });
	});

	it('accepts a source without currency', () => {
		expect(() => flattenLegacyCurrency({})).not.toThrow();
	});
});
