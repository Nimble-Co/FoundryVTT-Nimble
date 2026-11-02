import { describe, expect, it } from 'vitest';
import { weaponOptionsFor } from '../weaponAttack.js';

const weapon = (name: string, attackType: string, overrides: Record<string, unknown> = {}) => ({
	uuid: `Item.${name}`,
	name,
	type: 'object',
	system: {
		objectType: 'weapon',
		equipped: true,
		activation: {
			targets: { attackType, distance: 8 },
			effects: [{ type: 'damage', formula: '1d8+@dexterity', damageType: 'piercing' }],
		},
		...overrides,
	},
});

const actor = {
	items: [
		weapon('Longbow', 'range'),
		weapon('Sword', 'reach'),
		weapon('Stored Bow', 'range', { equipped: false }),
		{ uuid: 'Item.Rope', name: 'Rope', type: 'object', system: { objectType: 'misc' } },
	],
};

const names = (attack: Parameters<typeof weaponOptionsFor>[1]) =>
	weaponOptionsFor(actor, attack).map((option) => option.name);

describe('weaponOptionsFor', () => {
	it('lists the equipped weapons of the kind', () => {
		expect(names('ranged')).toEqual(['Longbow']);
		expect(names('melee')).toEqual(['Sword']);
		expect(names('any')).toEqual(['Longbow', 'Sword']);
	});

	it('lists nothing for an ability with its own damage', () => {
		expect(names('')).toEqual([]);
	});

	it("gives the weapon's damage and attack type", () => {
		expect(weaponOptionsFor(actor, 'ranged')[0]).toEqual({
			uuid: 'Item.Longbow',
			name: 'Longbow',
			formula: '1d8+@dexterity',
			damageType: 'piercing',
			attackType: 'range',
			distance: 8,
		});
	});
});
