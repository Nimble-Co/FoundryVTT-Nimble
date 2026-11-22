import { describe, expect, it } from 'vitest';

import { addOfferBonuses } from '../offerBonus.ts';

const juggernaut = { label: 'Juggernaut', itemUuid: 'Item.j', damage: 14, primaryDie: 1 };

describe('addOfferBonuses', () => {
	it('adds the flat damage with no flavor, and records it as a named part', () => {
		expect(addOfferBonuses('1d8', [juggernaut], false)).toEqual({
			formula: '1d8 + 14',
			primaryDieBonuses: [{ label: 'Juggernaut', value: 1, itemUuid: 'Item.j' }],
			damageParts: [{ label: 'Juggernaut', itemUuid: 'Item.j', amount: 14 }],
		});
	});

	it('records no part for a bonus with no damage, and no Primary Die line on an area roll', () => {
		expect(addOfferBonuses('1d8', [{ ...juggernaut, damage: 0 }], true)).toEqual({
			formula: '1d8',
			primaryDieBonuses: [],
			damageParts: [],
		});
	});
});
