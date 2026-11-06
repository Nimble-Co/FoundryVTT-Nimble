import { describe, expect, it } from 'vitest';
import { wearsArmorWithoutProficiency } from '../armorProficiency.js';

function armor(objectType: string, armorType = '', equipped = true) {
	return { type: 'object', system: { objectType, armorType, equipped } };
}

function hero(items: ReturnType<typeof armor>[], proficiencies: string[]) {
	return {
		type: 'character',
		rules: [],
		items,
		system: { proficiencies: { armor: new Set(proficiencies) } },
	};
}

describe('wearsArmorWithoutProficiency', () => {
	it('finds worn armor of a type the hero is not proficient with', () => {
		expect(wearsArmorWithoutProficiency(hero([armor('armor', 'plate')], ['cloth']))).toBe(true);
		expect(wearsArmorWithoutProficiency(hero([armor('armor', 'plate')], ['plate']))).toBe(false);
	});

	it('counts a shield as the shield type', () => {
		expect(wearsArmorWithoutProficiency(hero([armor('shield')], ['mail']))).toBe(true);
		expect(wearsArmorWithoutProficiency(hero([armor('shield')], ['shield']))).toBe(false);
	});

	it('does not check armor that is not worn', () => {
		expect(wearsArmorWithoutProficiency(hero([armor('armor', 'plate', false)], []))).toBe(false);
	});

	it('does not check armor that has no type', () => {
		expect(wearsArmorWithoutProficiency(hero([armor('armor')], []))).toBe(false);
	});
});
