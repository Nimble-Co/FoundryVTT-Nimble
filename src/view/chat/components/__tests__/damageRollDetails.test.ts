import { describe, expect, it } from 'vitest';

import { damageRollDetails, flavoredParts, primaryDieLine } from '../damageRollDetails.ts';

function options(
	rollOptions: Record<string, unknown>,
	faces: number | null = 6,
	primaryDieBonuses: { label: string; value: number }[] = [],
) {
	return { rollOptions, roll: { terms: faces ? [{ faces }] : [] }, primaryDieBonuses };
}

const plus = { class: 'OperatorTerm', operator: '+' };
const times = { class: 'OperatorTerm', operator: '*' };

describe('primaryDieLine', () => {
	it('returns null when nothing was set or added', () => {
		expect(primaryDieLine(options({ primaryDieModifier: 0 }))).toBeNull();
		expect(primaryDieLine({})).toBeNull();
	});

	it('folds the bonus and its source into one line', () => {
		expect(
			primaryDieLine(
				options({ primaryDieModifier: 1, primaryDieBaseResult: 4 }, 6, [
					{ label: 'Juggernaut', value: 1 },
				]),
			),
		).toMatchObject({ text: 'Primary Die: 4 + 1 (Juggernaut) = 5', tooltip: 'Juggernaut +1' });
	});

	it('shows the part no feature added with no name, and names the window in the tooltip', () => {
		expect(
			primaryDieLine(
				options({ primaryDieModifier: 3, primaryDieBaseResult: 2 }, 6, [
					{ label: 'Juggernaut', value: 1 },
				]),
			),
		).toMatchObject({
			text: 'Primary Die: 2 + 1 (Juggernaut) + 2 = 5',
			tooltip: 'Juggernaut +1, Add to Primary Die Result +2',
		});
	});

	it('shows a value set in the roll window in the same line', () => {
		expect(primaryDieLine(options({ primaryDieValue: 4 }))?.text).toBe('Primary Die: set to 4');
		expect(
			primaryDieLine(
				options({ primaryDieValue: 4, primaryDieModifier: 1, primaryDieBaseResult: 4 }, 6, [
					{ label: 'Juggernaut', value: 1 },
				]),
			)?.text,
		).toBe('Primary Die: set to 4, + 1 (Juggernaut) = 5');
	});

	it('shows a bonus that a set value kept off as not added, with the reason', () => {
		expect(
			primaryDieLine({
				...options(
					{ primaryDieModifier: 1, primaryDieBaseResult: 1, primaryDieBonusOff: true },
					6,
					[{ label: 'Juggernaut', value: 1 }],
				),
				bonusNotAdded: 'Lucky changed the die to 1.',
			}),
		).toMatchObject({
			text: 'Primary Die: 1, +1 (Juggernaut) not added',
			tooltip: 'Lucky changed the die to 1.',
			notAdded: true,
		});
	});

	it('stops at the max and at 1', () => {
		expect(primaryDieLine(options({ primaryDieModifier: 1, primaryDieBaseResult: 6 }))?.text).toBe(
			'Primary Die: 6 + 1 = 6, the max',
		);
		expect(primaryDieLine(options({ primaryDieModifier: -2, primaryDieBaseResult: 2 }))?.text).toBe(
			'Primary Die: 2 - 2 = 1, the lowest',
		);
	});

	it('falls back to the bonus alone on an old card that has no face before the bonus', () => {
		expect(
			primaryDieLine(options({ primaryDieModifier: 2 }, 6, [{ label: 'Juggernaut', value: 2 }]))
				?.text,
		).toBe('Added to Primary Die: + 2 (Juggernaut)');
	});

	it('shows no line on a roll that can neither crit nor miss', () => {
		expect(
			primaryDieLine(
				options({ canCrit: false, canMiss: false, primaryDieModifier: 1, primaryDieBaseResult: 3 }),
			),
		).toBeNull();
	});
});

describe('flavoredParts', () => {
	it('reads a flavored term with its amount, and adds up the same flavor', () => {
		expect(
			flavoredParts([
				{ class: 'PrimaryDie', results: [{ result: 4 }] },
				plus,
				{ class: 'NumericTerm', number: 5, options: { flavor: 'Fury Dice' } },
				plus,
				{ class: 'NumericTerm', number: 3, options: { flavor: 'Fury Dice' } },
				plus,
				{ class: 'NumericTerm', number: 14 },
			]),
		).toEqual([{ label: 'Fury Dice', amount: 8 }]);
	});

	it('works out a flavored product as one part', () => {
		expect(
			flavoredParts([
				{ class: 'Die', results: [{ result: 3 }] },
				plus,
				{ class: 'Die', results: [{ result: 5 }, { result: 2, discarded: true }] },
				times,
				{ class: 'NumericTerm', number: 2, options: { flavor: 'Lunging Strike' } },
			]),
		).toEqual([{ label: 'Lunging Strike', amount: 10 }]);
	});

	it('leaves out crit dice and the Primary Die', () => {
		expect(
			flavoredParts([
				{ class: 'PrimaryDie', results: [{ result: 4 }], options: { flavor: 'fire' } },
				plus,
				{ class: 'Die', results: [{ result: 6 }], options: { flavor: 'Brutal', dieRole: 'crit' } },
			]),
		).toEqual([]);
	});
});

describe('damageRollDetails', () => {
	it('lists the Primary Die line, then each recorded part, then each flavored part', () => {
		const lines = damageRollDetails({
			rollOptions: {
				primaryDieModifier: 1,
				primaryDieBaseResult: 4,
				damageParts: [
					{ label: 'Juggernaut', itemUuid: 'Item.j', amount: 14 },
					{ label: 'Hex', itemUuid: 'Item.h', formula: '(1)d6' },
				],
			},
			roll: {
				terms: [
					{ class: 'PrimaryDie', faces: 8, results: [{ result: 5 }] },
					plus,
					{ class: 'NumericTerm', number: 9, options: { flavor: 'Death Blow' } },
				],
			},
			primaryDieBonuses: [{ label: 'Juggernaut', value: 1 }],
		});
		expect(lines.map((line) => line.text)).toEqual([
			'Primary Die: 4 + 1 (Juggernaut) = 5',
			'Juggernaut: +14',
			'Hex: +1d6',
			'Death Blow: +9',
		]);
	});

	it('names the feature that made the box once', () => {
		const lines = damageRollDetails({
			rollOptions: {},
			roll: {
				terms: [{ class: 'NumericTerm', number: 6, options: { flavor: 'Withering Strike' } }],
			},
			source: { label: 'Withering Strike', uuid: 'Item.w' },
		});
		expect(lines.map((line) => line.text)).toEqual(['From Withering Strike']);
	});

	it('shows an old card with no record and no options with no lines', () => {
		expect(damageRollDetails({ rollOptions: {}, roll: { terms: [] } })).toEqual([]);
		expect(damageRollDetails({})).toEqual([]);
	});
});
