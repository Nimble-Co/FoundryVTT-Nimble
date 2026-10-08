import { beforeEach, describe, expect, it } from 'vitest';
import { getItemCost, transformItem } from './itemPiles.js';

function priced(value: number, denomination: string) {
	return { system: { price: { value, denomination } } };
}

describe('itemPiles integration', () => {
	beforeEach(() => {
		(CONFIG as unknown as { NIMBLE: object }).NIMBLE = {
			currencies: {
				gp: { exchangeRate: 1 },
				sp: { exchangeRate: 0.1 },
				cp: { exchangeRate: 0.01 },
			},
		};
	});

	describe('getItemCost', () => {
		it.each([
			[5, 'gp', 5],
			[5, 'sp', 0.5],
			[5, 'cp', 0.05],
		])('reads %i %s as %f gold', (value, denomination, expected) => {
			expect(getItemCost(priced(value, denomination))).toBeCloseTo(expected);
		});

		it('uses the rate set in Item Piles before the system rate', () => {
			const currencies = [{ data: { path: 'system.currency.sp' }, exchangeRate: 0.5 }];

			expect(getItemCost(priced(4, 'sp'), currencies)).toBe(2);
		});

		it('reads an item without a price as 0', () => {
			expect(getItemCost({ system: {} })).toBe(0);
		});
	});

	describe('transformItem', () => {
		it('clears the equipped state and the container of the previous owner', () => {
			const item = { system: { equipped: true, containerId: 'abc', quantity: 2 } };

			expect(transformItem(item).system).toEqual({ equipped: false, containerId: '', quantity: 2 });
		});

		it('returns an object for empty item data', () => {
			expect(transformItem({})).toEqual({});
		});
	});
});
