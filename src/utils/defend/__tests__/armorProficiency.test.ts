import { describe, expect, it } from 'vitest';
import resolveHeroicReactionActionCost from '../../incomingReactions/resolveHeroicReactionActionCost.js';
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

	it('does not check armor that is not worn, or that has no type', () => {
		expect(wearsArmorWithoutProficiency(hero([armor('armor', 'plate', false)], []))).toBe(false);
		expect(wearsArmorWithoutProficiency(hero([armor('armor')], []))).toBe(false);
	});
});

describe('Defend cost in armor worn without proficiency', () => {
	it('costs 1 more action for Defend only', () => {
		const actor = hero([armor('armor', 'mail')], ['leather']);

		expect(resolveHeroicReactionActionCost(actor as never, ['defend'])).toBe(2);
		expect(resolveHeroicReactionActionCost(actor as never, ['interpose'])).toBe(1);
		expect(resolveHeroicReactionActionCost(actor as never, ['interpose', 'defend'])).toBe(3);
	});
});
