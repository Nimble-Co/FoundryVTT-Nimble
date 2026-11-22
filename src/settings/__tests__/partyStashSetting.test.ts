import { describe, expect, it } from 'vitest';
import { emptyPartyStash, normalizePartyStash, partyCoin } from '../partyStashSetting.ts';

describe('normalizePartyStash', () => {
	it('starts empty', () => {
		expect(emptyPartyStash()).toEqual({ currency: { gp: 0, sp: 0, cp: 0 }, items: [] });
	});

	it('keeps object rows and drops a bad coin or a non-object', () => {
		expect(
			normalizePartyStash({
				currency: { gp: 4.8, sp: -3, cp: 'nope' },
				items: [
					{ _id: 'torch', type: 'object', name: 'Torch', system: { quantity: 2 } },
					{ _id: '', type: 'object', name: 'Blank' },
					{ _id: 'rage', type: 'feature', name: 'Rage' },
					null,
				],
			}),
		).toEqual({
			currency: { gp: 4, sp: 0, cp: 0 },
			items: [{ _id: 'torch', type: 'object', name: 'Torch', system: { quantity: 2 } }],
		});
	});

	it('reads an empty stash from anything that is not the setting', () => {
		expect(normalizePartyStash(null)).toEqual(emptyPartyStash());
		expect(normalizePartyStash('nope')).toEqual(emptyPartyStash());
	});

	it('names the three coins', () => {
		expect(partyCoin('gp')).toBe(true);
		expect(partyCoin('pp')).toBe(false);
	});
});
