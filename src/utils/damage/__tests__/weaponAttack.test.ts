import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	halfRangeTag,
	halfRangeText,
	UNARMED_STRIKE,
	useWeaponDamage,
	weaponOptionsFor,
} from '../weaponAttack.js';

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

describe('halfRangeText', () => {
	it('names the halved range of a half range attack', () => {
		expect(halfRangeText({ halfRange: true, targets: { attackType: 'range', distance: 8 } })).toBe(
			'Range 8 (half range)',
		);
	});

	it('is empty for a melee attack or an attack that is not half range', () => {
		expect(halfRangeText({ halfRange: true, targets: { attackType: 'reach', distance: 1 } })).toBe(
			'',
		);
		expect(halfRangeText({ targets: { attackType: 'range', distance: 16 } })).toBe('');
	});
});

describe('halfRangeTag', () => {
	it('names only the halved range, as the card description says half range', () => {
		expect(halfRangeTag({ halfRange: true, targets: { attackType: 'range', distance: 8 } })).toBe(
			'Range 8',
		);
		expect(halfRangeTag({ targets: { attackType: 'range', distance: 16 } })).toBe('');
	});
});

describe('the Hunter shots marked "(Half range)" in the book', () => {
	const DIR = 'packs/classFeatures/core/hunter/thrill-of-the-hunt';
	const halfRange = (file: string) =>
		JSON.parse(readFileSync(resolve(DIR, file), 'utf8')).system.activation.halfRange;

	it.each([
		'incendiary-shot.json',
		'vital-shot.json',
		'heavy-shot.json',
		'multishot.json',
		'hail-of-arrows.json',
	])('%s attacks at half range', (file) => {
		expect(halfRange(file)).toBe(true);
	});

	it('leaves the other shots at full range', () => {
		expect(halfRange('pinning-shot.json')).toBeFalsy();
	});
});
