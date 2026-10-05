import { describe, expect, it } from 'vitest';
import {
	checkWeaponAttack,
	type EquipmentActor,
	getStrengthShortfall,
	type WeaponItem,
} from './weaponAttackLegality.js';

interface WeaponOptions {
	objectType?: string;
	equipped?: boolean;
	properties?: string[];
	strength?: number | null;
	overridesTwoHanded?: boolean;
}

function weapon({
	objectType = 'weapon',
	equipped = true,
	properties = [],
	strength = null,
	overridesTwoHanded = false,
}: WeaponOptions = {}): WeaponItem {
	return {
		id: 'weapon-1',
		name: 'Weapon',
		type: 'object',
		system: {
			objectType,
			equipped,
			properties: {
				selected: properties,
				strengthRequirement: { value: strength, overridesTwoHanded },
			},
		},
	};
}

function actor(strengthMod = 0): EquipmentActor {
	return { system: { abilities: { strength: { mod: strengthMod } } } };
}

describe('checkWeaponAttack', () => {
	it('allows an equipped weapon', () => {
		expect(checkWeaponAttack(weapon())).toEqual({ allowed: true });
	});

	it('refuses a weapon that is not equipped', () => {
		expect(checkWeaponAttack(weapon({ equipped: false }))).toEqual({
			allowed: false,
			refusal: 'notEquipped',
		});
	});

	it('leaves anything that is not a weapon alone', () => {
		expect(checkWeaponAttack(weapon({ objectType: 'armor', equipped: false }))).toEqual({
			allowed: true,
		});
	});

	it('allows an equipped weapon whose strength requirement is not met', () => {
		const greatsword = weapon({ properties: ['twoHanded'], strength: 3 });

		expect(checkWeaponAttack(greatsword)).toEqual({ allowed: true });
	});
});

describe('getStrengthShortfall', () => {
	it('reports the gap when strength falls short of a flat requirement', () => {
		const greatsword = weapon({ properties: ['twoHanded'], strength: 3 });

		expect(getStrengthShortfall(actor(1), greatsword)).toEqual({ required: 3, current: 1 });
	});

	it('reports nothing once strength meets the requirement', () => {
		const greatsword = weapon({ properties: ['twoHanded'], strength: 3 });

		expect(getStrengthShortfall(actor(3), greatsword)).toBeNull();
	});

	it('reports nothing for an override requirement, which only buys one-handed use', () => {
		const longsword = weapon({
			properties: ['twoHanded'],
			strength: 2,
			overridesTwoHanded: true,
		});

		expect(getStrengthShortfall(actor(0), longsword)).toBeNull();
	});

	it('reports nothing for a weapon with no requirement', () => {
		expect(getStrengthShortfall(actor(0), weapon())).toBeNull();
	});

	it('reports nothing for an item carrying no strengthRequirement at all', () => {
		const bare = weapon();
		delete (bare.system.properties as { strengthRequirement?: unknown }).strengthRequirement;

		expect(getStrengthShortfall(actor(0), bare)).toBeNull();
	});
});
