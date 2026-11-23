import { describe, expect, it } from 'vitest';
import {
	applyDamageFormulaChoices,
	type DamageFormulaChoiceOffer,
	damageFormulaChoiceOffers,
	replaceDiceTerm,
} from '../damageFormulaChoice.js';

const longbow = {
	type: 'damageFormulaChoice',
	id: 'vb-longbow',
	label: 'Versatile Bowmaster',
	itemIdentifier: 'longbow',
	from: '1d8',
	to: '2d4',
	parentDocument: { uuid: 'Item.versatile-bowmaster', name: 'Versatile Bowmaster' },
};

const crossbow = {
	...longbow,
	id: 'vb-crossbow',
	itemIdentifier: 'crossbow',
	from: '4d4',
	to: '2d8',
};

function offers(itemIdentifier: string, formula: string, rules: object[]) {
	return damageFormulaChoiceOffers({ rules }, itemIdentifier, formula);
}

describe('replaceDiceTerm', () => {
	it('replaces one whole dice term and leaves the rest', () => {
		expect(replaceDiceTerm('1d8+@dexterity', '1d8', '2d4')).toBe('2d4+@dexterity');
		expect(replaceDiceTerm('4d4+@dexterity', '4d4', '2d8')).toBe('2d8+@dexterity');
		expect(replaceDiceTerm('1d8+1d8', '1d8', '2d4')).toBe('2d4+1d8');
	});

	it('does not match a longer term, a different die, or different case', () => {
		expect(replaceDiceTerm('11d8+@dexterity', '1d8', '2d4')).toBeNull();
		expect(replaceDiceTerm('1d80+@dexterity', '1d8', '2d4')).toBeNull();
		expect(replaceDiceTerm('1d8cv', '1d8', '2d4')).toBeNull();
		expect(replaceDiceTerm('1d6+@dexterity', '1d8', '2d4')).toBeNull();
		expect(replaceDiceTerm('1D8+@dexterity', '1d8', '2d4')).toBeNull();
	});

	it('treats dice text as text, so a plus in it is not a pattern', () => {
		expect(replaceDiceTerm('1d8+2+@strength', '1d8+2', '2d4')).toBe('2d4+@strength');
	});

	it('matches nothing when either side is blank', () => {
		expect(replaceDiceTerm('1d8', '', '2d4')).toBeNull();
		expect(replaceDiceTerm('1d8', '1d8', '  ')).toBeNull();
	});
});

describe('damageFormulaChoiceOffers', () => {
	it('offers the rule whose item and dice are the attack', () => {
		expect(offers('longbow', '1d8+@dexterity', [longbow, crossbow])).toEqual([
			{
				key: 'Item.versatile-bowmaster:vb-longbow',
				label: 'Versatile Bowmaster',
				from: '1d8',
				to: '2d4',
			},
		]);
		expect(offers('crossbow', '4d4+@dexterity', [longbow, crossbow])).toEqual([
			expect.objectContaining({ from: '4d4', to: '2d8' }),
		]);
	});

	it('offers nothing for another weapon, a blank item, or dice that are not there', () => {
		expect(offers('shortbow', '1d6+@dexterity', [longbow, crossbow])).toEqual([]);
		expect(offers('', '1d8+@dexterity', [longbow])).toEqual([]);
		expect(offers('longbow', '1d10+@dexterity', [longbow])).toEqual([]);
	});

	it('skips a disabled rule and a rule whose condition fails', () => {
		expect(offers('longbow', '1d8', [{ ...longbow, disabled: true }])).toEqual([]);
		expect(offers('longbow', '1d8', [{ ...longbow, appliesTo: () => false }])).toEqual([]);
		expect(offers('longbow', '1d8', [{ ...longbow, test: () => false }])).toEqual([]);
	});

	it('matches a blank item identifier to the rule item', () => {
		const onTheBow = {
			...longbow,
			itemIdentifier: '',
			parentDocument: { uuid: 'Item.longbow', name: 'Longbow' },
		};
		expect(offers('longbow', '1d8+@dexterity', [onTheBow])).toHaveLength(1);
		expect(offers('crossbow', '1d8+@dexterity', [onTheBow])).toEqual([]);
	});
});

describe('applyDamageFormulaChoices', () => {
	const offer = (key: string, from: string, to: string): DamageFormulaChoiceOffer => ({
		key,
		label: 'Choice',
		from,
		to,
	});

	it('leaves the formula alone when the tick is off', () => {
		const ticks = [offer('bow', '1d8', '2d4')];
		expect(applyDamageFormulaChoices('1d8+@dexterity', ticks, {})).toBeNull();
	});

	it('applies the checked ticks in order', () => {
		const ticks = [offer('bow', '1d8', '2d4'), offer('cross', '4d4', '2d8')];
		expect(applyDamageFormulaChoices('1d8+4d4+@dexterity', ticks, { bow: true, cross: true })).toBe(
			'2d4+2d8+@dexterity',
		);
	});
});
