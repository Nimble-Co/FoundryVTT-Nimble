import { describe, expect, it } from 'vitest';
import { isCoinDenomination } from '../coins.ts';

describe('isCoinDenomination', () => {
	it('names the three coins', () => {
		expect(isCoinDenomination('gp')).toBe(true);
		expect(isCoinDenomination('pp')).toBe(false);
	});
});
