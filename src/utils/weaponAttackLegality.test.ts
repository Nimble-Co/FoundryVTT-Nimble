import { describe, expect, it } from 'vitest';
import { checkWeaponAttack } from './weaponAttackLegality.js';
import type { EquipmentActor, HandItem } from './weaponHands.js';

interface WeaponOptions {
	id?: string;
	name?: string;
	objectType?: string;
	equipped?: boolean;
	properties?: string[];
	strength?: number | null;
	overridesTwoHanded?: boolean;
}

function weapon({
	id = 'weapon-1',
	name = 'Weapon',
	objectType = 'weapon',
	equipped = true,
	properties = [],
	strength = null,
	overridesTwoHanded = false,
}: WeaponOptions = {}): HandItem {
	return {
		id,
		name,
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

function actor(held: HandItem[], strengthMod = 0, extraHands = 0): EquipmentActor {
	return {
		items: { filter: (predicate) => held.filter(predicate) },
		system: {
			abilities: { strength: { mod: strengthMod } },
			attributes: { extraHands },
		},
	};
}

const shield = weapon({ id: 'shield-1', name: 'Wooden Buckler', objectType: 'shield' });
const greatsword = weapon({
	id: 'greatsword',
	name: 'Greatsword',
	properties: ['twoHanded'],
	strength: 2,
});
const longsword = weapon({
	id: 'longsword',
	name: 'Longsword',
	properties: ['twoHanded'],
	strength: 2,
	overridesTwoHanded: true,
});

describe('checkWeaponAttack', () => {
	it('refuses an unequipped weapon', () => {
		const dagger = weapon({ equipped: false });
		const check = checkWeaponAttack(actor([]), dagger);

		expect(check.allowed).toBe(false);
		expect(check.refusal).toBe('notEquipped');
	});

	it('allows an equipped one-handed weapon with both hands full', () => {
		const dagger = weapon({ id: 'dagger', properties: ['light'] });
		const check = checkWeaponAttack(actor([dagger, shield], 0), dagger);

		expect(check.allowed).toBe(true);
		expect(check.requiresSwap).toBe(false);
	});

	it('allows a two-handed weapon when the other hand is free', () => {
		const check = checkWeaponAttack(actor([greatsword], 2), greatsword);

		expect(check.allowed).toBe(true);
		expect(check.requiresSwap).toBe(false);
	});

	it('refuses a two-handed weapon below its strength requirement', () => {
		const check = checkWeaponAttack(actor([greatsword], 1), greatsword);

		expect(check.allowed).toBe(false);
		expect(check.refusal).toBe('strengthRequirement');
		expect(check.strengthRequired).toBe(2);
	});

	it('never wields a great weapon one-handed, even at high strength', () => {
		const check = checkWeaponAttack(actor([greatsword, shield], 4), greatsword);

		expect(check.requiresSwap).toBe(true);
	});

	describe('a two-handed weapon alongside a shield', () => {
		it('offers the attack and spends a swap to sheathe the shield', () => {
			const check = checkWeaponAttack(actor([greatsword, shield], 2), greatsword);

			expect(check.allowed).toBe(true);
			expect(check.requiresSwap).toBe(true);
			expect(check.sheatheCandidates.map((item) => item.id)).toEqual(['shield-1']);
		});

		it('refuses once the round has no swaps left', () => {
			const combatant = {
				id: 'c1',
				type: 'character',
				system: { equipmentSwaps: { round: 3, spent: 1 } },
				update: async () => undefined,
			};
			const check = checkWeaponAttack(actor([greatsword, shield], 2), greatsword, {
				combatant,
				combat: { round: 3, combatants: { find: () => combatant } },
			});

			expect(check.allowed).toBe(false);
			expect(check.refusal).toBe('noSwapsLeft');
		});

		it('needs no swap when an extra hand is available', () => {
			const check = checkWeaponAttack(actor([greatsword, shield], 2, 1), greatsword);

			expect(check.allowed).toBe(true);
			expect(check.requiresSwap).toBe(false);
		});
	});

	describe('a weapon whose strength requirement overrides two-handed', () => {
		it('is wielded one-handed alongside a shield at the required strength', () => {
			const check = checkWeaponAttack(actor([longsword, shield], 2), longsword);

			expect(check.allowed).toBe(true);
			expect(check.requiresSwap).toBe(false);
		});

		it('falls back to two hands below the required strength', () => {
			const check = checkWeaponAttack(actor([longsword, shield], 1), longsword);

			expect(check.allowed).toBe(true);
			expect(check.requiresSwap).toBe(true);
		});

		it('is still usable two-handed below the required strength with a hand free', () => {
			const check = checkWeaponAttack(actor([longsword], 1), longsword);

			expect(check.allowed).toBe(true);
			expect(check.requiresSwap).toBe(false);
		});
	});
});
