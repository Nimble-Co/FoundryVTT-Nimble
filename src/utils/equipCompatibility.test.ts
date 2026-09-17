import { describe, expect, it } from 'vitest';
import checkEquip from './equipCompatibility.js';
import type { EquipmentActor, HandItem } from './weaponHands.js';

function item(
	id: string,
	objectType: string,
	properties: string[] = [],
	equipped = true,
): HandItem {
	return {
		id,
		name: id,
		type: 'object',
		system: {
			objectType,
			equipped,
			properties: {
				selected: properties,
				strengthRequirement: { value: null, overridesTwoHanded: false },
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

const dagger = item('dagger', 'weapon', ['light']);
const shortSword = item('short-sword', 'weapon', ['light']);
const mace = item('mace', 'weapon');
const rapier = item('rapier', 'weapon');
const shield = item('shield', 'shield');
const greatsword = item('greatsword', 'weapon', ['twoHanded']);

describe('checkEquip', () => {
	it('refuses when no hand is free', () => {
		const check = checkEquip(actor([mace, shield]), dagger);

		expect(check.allowed).toBe(false);
		expect(check.refusal).toBe('noFreeHand');
	});

	it('allows armor with both hands full', () => {
		const check = checkEquip(actor([mace, shield]), item('chainmail', 'armor'));

		expect(check.allowed).toBe(true);
	});

	it('equips a two-handed weapon alongside a shield without unequipping it', () => {
		const check = checkEquip(actor([shield]), greatsword);

		expect(check.allowed).toBe(true);
	});

	describe('dual wielding', () => {
		it('allows two Light weapons at any strength', () => {
			const check = checkEquip(actor([dagger], 0), shortSword);

			expect(check.allowed).toBe(true);
		});

		it('allows one non-Light weapon alongside a Light one at strength 2', () => {
			const check = checkEquip(actor([dagger], 2), mace);

			expect(check.allowed).toBe(true);
		});

		it('refuses one non-Light weapon alongside a Light one below strength 2', () => {
			const check = checkEquip(actor([dagger], 1), mace);

			expect(check.allowed).toBe(false);
			expect(check.refusal).toBe('dualWieldStrength');
			expect(check.strengthRequired).toBe(2);
		});

		it('requires strength 3 for two non-Light weapons', () => {
			expect(checkEquip(actor([mace], 2), rapier).allowed).toBe(false);
			expect(checkEquip(actor([mace], 2), rapier).strengthRequired).toBe(3);
			expect(checkEquip(actor([mace], 3), rapier).allowed).toBe(true);
		});

		it('leaves a single non-Light weapon unrestricted', () => {
			const check = checkEquip(actor([], 0), mace);

			expect(check.allowed).toBe(true);
		});
	});
});
