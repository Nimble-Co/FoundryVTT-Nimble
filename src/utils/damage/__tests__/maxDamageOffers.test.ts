import { describe, expect, it } from 'vitest';
import { maxDamageOffers, maxDamageRuleOf } from '../maxDamageOffers.js';

const rule = (overrides: object = {}) => ({
	type: 'maxDamage',
	id: 'r',
	item: { name: 'Stormborn (2)', uuid: 'Actor.h.Item.s' },
	use: 'damage',
	chargePoolIdentifier: '',
	chargeCost: 1,
	canPay: true,
	covers: () => true,
	...overrides,
});

const itemWith = (type: string, formula: string, extra: object = {}) => ({
	system: { activation: { effects: [{ id: 'n', type, formula, ...extra }] } },
});

describe('the Max Damage ticks of a roll window', () => {
	it('show for an item that rolls that kind of dice', () => {
		const [offer] = maxDamageOffers({ rules: [rule()] }, itemWith('damage', '3d8'));

		expect(offer).toMatchObject({ label: 'Stormborn (2)', use: 'damage', chargeCost: 0 });
	});

	it('do not show for a healing rule on a damage item', () => {
		expect(
			maxDamageOffers({ rules: [rule({ use: 'healing' })] }, itemWith('damage', '1d8')),
		).toEqual([]);
	});

	it('do not show for a formula with no dice', () => {
		expect(maxDamageOffers({ rules: [rule()] }, itemWith('damage', '5'))).toEqual([]);
	});

	it('do not show when the filter of the rule leaves the item out', () => {
		expect(
			maxDamageOffers({ rules: [rule({ covers: () => false })] }, itemWith('damage', '1d8')),
		).toEqual([]);
	});

	it('tell the cost and that no use is left', () => {
		const [offer] = maxDamageOffers(
			{ rules: [rule({ chargePoolIdentifier: 'beastshift', canPay: false })] },
			itemWith('damage', '3d8'),
		);

		expect(offer).toMatchObject({ chargeCost: 1, canPay: false });
	});

	it('give the temp HP choice only to healing', () => {
		const [offer] = maxDamageOffers(
			{ rules: [rule({ use: 'healing', tempHpChoice: true })] },
			itemWith('healing', '2d6'),
		);

		expect(offer.tempHpChoice).toBe(true);
	});
});

describe('the rule of a picked tick', () => {
	const hero = { rules: [rule()] };
	const item = itemWith('damage', '3d8');

	it('is found by its key', () => {
		expect(maxDamageRuleOf(hero, item, { key: 'Actor.h.Item.s:r', tempHp: false })).toBe(
			hero.rules[0],
		);
	});

	it('is null when the uses went away after the window opened', () => {
		const spent = { rules: [rule({ canPay: false })] };

		expect(maxDamageRuleOf(spent, item, { key: 'Actor.h.Item.s:r', tempHp: false })).toBeNull();
	});

	it('is null with no pick', () => {
		expect(maxDamageRuleOf(hero, item, null)).toBeNull();
	});
});
