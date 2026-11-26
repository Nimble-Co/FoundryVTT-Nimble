import { describe, expect, it } from 'vitest';
import {
	canAttackWith,
	type EquipmentActor,
	getStrengthNotice,
	type WeaponItem,
} from '../weaponAttackLegality.js';

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

describe('canAttackWith', () => {
	it('allows an equipped weapon', () => {
		expect(canAttackWith(weapon())).toBe(true);
	});

	it('refuses a weapon that is not equipped', () => {
		expect(canAttackWith(weapon({ equipped: false }))).toBe(false);
	});

	it('leaves anything that is not a weapon alone', () => {
		expect(canAttackWith(weapon({ objectType: 'armor', equipped: false }))).toBe(true);
	});

	it('allows an equipped weapon whose strength requirement is not met', () => {
		const greatsword = weapon({ properties: ['twoHanded'], strength: 3 });

		expect(canAttackWith(greatsword)).toBe(true);
	});
});

describe('getStrengthNotice', () => {
	it('names the required and current Strength when strength falls short', () => {
		const greatsword = weapon({ properties: ['twoHanded'], strength: 3 });

		expect(getStrengthNotice(actor(1), greatsword)).toBe('Requires Strength 3. You have 1.');
	});

	it('reports nothing once strength meets the requirement', () => {
		const greatsword = weapon({ properties: ['twoHanded'], strength: 3 });

		expect(getStrengthNotice(actor(3), greatsword)).toBeNull();
	});

	it('reports nothing for a weapon that is not equipped', () => {
		const greatsword = weapon({ properties: ['twoHanded'], strength: 3, equipped: false });

		expect(getStrengthNotice(actor(1), greatsword)).toBeNull();
	});

	it('reports nothing for an override requirement, which only buys one-handed use', () => {
		const longsword = weapon({
			properties: ['twoHanded'],
			strength: 2,
			overridesTwoHanded: true,
		});

		expect(getStrengthNotice(actor(0), longsword)).toBeNull();
	});

	it('reports nothing for a weapon with no requirement', () => {
		expect(getStrengthNotice(actor(0), weapon())).toBeNull();
	});

	it('reports nothing for an item carrying no strengthRequirement at all', () => {
		const bare = weapon();
		delete (bare.system.properties as { strengthRequirement?: unknown }).strengthRequirement;

		expect(getStrengthNotice(actor(0), bare)).toBeNull();
	});
});
