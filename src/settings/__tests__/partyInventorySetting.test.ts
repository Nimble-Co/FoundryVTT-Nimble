import { describe, expect, it } from 'vitest';
import { emptyPartyInventory, normalizePartyInventory } from '../partyInventorySetting.ts';

describe('normalizePartyInventory', () => {
	it('starts empty', () => {
		expect(emptyPartyInventory()).toEqual({ currency: { gp: 0, sp: 0, cp: 0 }, items: [] });
	});

	it('keeps object rows and drops a bad coin or a non-object', () => {
		expect(
			normalizePartyInventory({
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

	it('reads an empty inventory from anything that is not the setting', () => {
		expect(normalizePartyInventory(null)).toEqual(emptyPartyInventory());
		expect(normalizePartyInventory('nope')).toEqual(emptyPartyInventory());
	});
});
