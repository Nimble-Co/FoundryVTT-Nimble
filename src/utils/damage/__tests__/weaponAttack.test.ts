import { describe, expect, it } from 'vitest';
import { UNARMED_STRIKE, useWeaponDamage, weaponOptionsFor } from '../weaponAttack.js';

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
		weapon('Stored Bow', 'range', { equipped: false }),
		weapon('Longbow', 'range'),
		weapon('Sword', 'reach'),
		{ uuid: 'Item.Rope', name: 'Rope', type: 'object', system: { objectType: 'misc' } },
	],
};

const names = (attack: Parameters<typeof weaponOptionsFor>[1]) =>
	weaponOptionsFor(actor, attack).map((option) => option.name);

describe('weaponOptionsFor', () => {
	it('lists every weapon of the kind, the equipped ones first', () => {
		expect(names('ranged')).toEqual(['Longbow', 'Stored Bow']);
		expect(names('melee')).toEqual(['Sword']);
		expect(names('any')).toEqual(['Longbow', 'Sword', 'Stored Bow']);
	});

	it('says which weapons are equipped', () => {
		expect(weaponOptionsFor(actor, 'ranged').map((option) => option.equipped)).toEqual([
			true,
			false,
		]);
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
			equipped: true,
		});
	});
});

describe('weaponOptionsFor Unarmed Strike', () => {
	const hero = {
		type: 'character',
		system: { unarmedDamage: '1d6 + @abilities.strength.mod' },
		items: [
			weapon('Club', 'reach', { equipped: false }),
			weapon('Dagger', 'reach'),
			weapon('Longbow', 'range'),
		],
	};
	const heroNames = (attack: Parameters<typeof weaponOptionsFor>[1]) =>
		weaponOptionsFor(hero, attack).map((option) => option.name);

	it('comes after the equipped weapons of a melee or any ability', () => {
		expect(heroNames('melee')).toEqual(['Dagger', 'Unarmed Strike', 'Club']);
		expect(heroNames('any')).toEqual(['Dagger', 'Longbow', 'Unarmed Strike', 'Club']);
	});

	it('is the only choice of an unarmed ability', () => {
		expect(heroNames('unarmed')).toEqual(['Unarmed Strike']);
	});

	it('is not a choice of a ranged ability', () => {
		expect(heroNames('ranged')).toEqual(['Longbow']);
	});

	it("rolls the hero's unarmed damage at reach 1", () => {
		expect(weaponOptionsFor(hero, 'unarmed')[0]).toEqual({
			uuid: UNARMED_STRIKE,
			name: 'Unarmed Strike',
			formula: '1d6 + @abilities.strength.mod',
			damageType: 'bludgeoning',
			attackType: 'reach',
			distance: 1,
			equipped: true,
		});
	});

	it('is a choice only for a hero', () => {
		expect(weaponOptionsFor({ ...hero, type: 'npc' }, 'unarmed')).toEqual([]);
	});
});

describe('useWeaponDamage', () => {
	const bow = weaponOptionsFor(actor, 'ranged')[0] as NonNullable<
		ReturnType<typeof weaponOptionsFor>[number]
	>;

	it('changes the first damage node of the tree itself, and no other', () => {
		const first = { type: 'damage', formula: '1d6', damageType: 'slashing' };
		const second = { type: 'damage', formula: '(@will)d8', damageType: 'fire' };
		useWeaponDamage([first, second], bow);
		expect(first).toMatchObject({ formula: '1d8+@dexterity', damageType: 'piercing' });
		expect(second).toMatchObject({ formula: '(@will)d8', damageType: 'fire' });
	});

	it('finds a damage node under another node', () => {
		const inner = { type: 'damage', formula: '1d6', damageType: 'slashing' };
		useWeaponDamage([{ type: 'savingThrow', on: { failedSave: [inner] } }], bow);
		expect(inner.formula).toBe('1d8+@dexterity');
	});
});
