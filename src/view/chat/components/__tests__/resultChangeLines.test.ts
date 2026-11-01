import { describe, expect, it } from 'vitest';
import type { ResultChange } from '#utils/incomingReactions/incomingReactionEntry.ts';
import {
	resultAmount,
	resultChangeLines,
	resultSumText,
	statChoiceLabel,
} from '../resultChangeLines.ts';

const MINUS = '−';
function click(overrides: Partial<ResultChange> = {}): ResultChange {
	return {
		id: 'a',
		lineId: 'a',
		entryId: 'entry',
		itemUuid: 'Item.soul',
		ruleId: 'rule',
		label: 'Soul rule',
		actorUuid: 'Actor.hero',
		change: 'add',
		value: 3,
		stat: 'strength',
		retired: false,
		before: null,
		chargePoolIdentifier: '',
		paid: { charges: 0, mana: 0, wounds: 1 },
		...overrides,
	};
}

function linesOf(changes: ResultChange[], rollTotal = 7, canRemove = true) {
	return resultChangeLines({
		changes,
		rollTotal,
		speakerUuid: 'Actor.hero',
		documentName: (uuid) => ({ 'Item.soul': 'Mighty Soul', 'Actor.ally': 'Pip' })[uuid],
		canRemove: () => canRemove,
	});
}

describe('resultAmount', () => {
	it('names the stat with its sign', () => {
		expect(resultAmount({ value: 3, stat: 'strength' })).toBe('+3 STR');
	});

	it('shows a negative value with a true minus sign', () => {
		expect(resultAmount({ value: -1, stat: 'strength' })).toBe(`${MINUS}1 STR`);
	});

	it('shows only the number with no stat', () => {
		expect(resultAmount({ value: 2, stat: '' })).toBe('+2');
	});
});

describe('statChoiceLabel', () => {
	it('shows the stat with a signed modifier', () => {
		expect(statChoiceLabel({ stat: 'dexterity', mod: 2 })).toBe('DEX +2');
		expect(statChoiceLabel({ stat: 'intelligence', mod: 0 })).toBe('INT +0');
		expect(statChoiceLabel({ stat: 'will', mod: -1 })).toBe(`WIL ${MINUS}1`);
	});
});

describe('resultChangeLines', () => {
	const documentName = (uuid: string) =>
		({ 'Item.res': 'Epic Resistance', 'Item.soul': 'Bumblewise', 'Token.a': 'Goblin' })[uuid];

	it('tells a no damage line with its target, and Remove follows the gate', () => {
		const line = (canRemove: boolean) =>
			resultChangeLines({
				changes: [
					click({
						change: 'noDamage',
						value: 0,
						stat: '',
						itemUuid: 'Item.res',
						targetTokenUuid: 'Token.a',
					}),
				],
				rollTotal: 7,
				speakerUuid: 'Actor.hero',
				documentName,
				canRemove: () => canRemove,
			})[0];
		expect(line(true).sentence).toBe('No Damage for Goblin with Epic Resistance');
		expect(line(true).canRemove).toBe(true);
		expect(line(false).canRemove).toBe(false);
	});

	it('tells a natural 20, with no Remove when it was automatic', () => {
		const lines = (automatic: boolean) =>
			resultChangeLines({
				changes: [click({ change: 'countsAsNat20', value: 19, stat: '', automatic })],
				rollTotal: 1,
				speakerUuid: 'Actor.hero',
				documentName,
				canRemove: () => true,
			})[0];
		expect(lines(true).sentence).toBe('Counts as a Natural 20 with Bumblewise');
		expect(lines(true).canRemove).toBe(false);
		expect(lines(false).canRemove).toBe(true);
	});

	it('tells a succeed', () => {
		const [line] = linesOf([click({ change: 'succeed', value: 0, stat: '' })]);
		expect(line.verb).toBe('Succeeded Instead');
		expect(line.withFeature).toBe('with Mighty Soul');
		expect(line.sentence).toBe('Succeeded Instead with Mighty Soul');
	});

	it('tells a set total from the total it replaced', () => {
		const [line] = linesOf([click({ change: 'setTotal', value: 10, stat: '' })]);
		expect(line.verb).toBe('Changed 7 to 10');
	});

	it('reads the replaced total from the changes before it', () => {
		const lines = linesOf([
			click(),
			click({ id: 'b', lineId: 'b', change: 'setTotal', value: 20 }),
		]);
		expect(lines[1].verb).toBe('Changed 10 to 20');
	});

	it('grows one line for the clicks of one add, with the Wounds that were paid', () => {
		const lines = linesOf([click(), click({ id: 'b' })]);
		expect(lines).toHaveLength(1);
		expect(lines[0].id).toBe('a');
		expect(lines[0].verb).toBe('Added +6 STR, Gained 2 Wounds');
	});

	it('says one Wound, and no Wounds when none were paid', () => {
		expect(linesOf([click()])[0].verb).toBe('Added +3 STR, Gained 1 Wound');
		const free = click({ paid: { charges: 0, mana: 0, wounds: 0 } });
		expect(linesOf([free])[0].verb).toBe('Added +3 STR');
	});

	it('shows a negative add with a true minus sign', () => {
		const free = click({ value: -1, paid: { charges: 0, mana: 0, wounds: 0 } });
		expect(linesOf([free])[0].verb).toBe(`Added ${MINUS}1 STR`);
	});

	it('names another user of the feature', () => {
		expect(linesOf([click()])[0].detail).toBeNull();
		expect(linesOf([click({ actorUuid: 'Actor.ally' })])[0].detail).toBe('Used by Pip');
	});

	it('keeps a retired line with no Remove, telling the total of that time', () => {
		const set = click({ change: 'setTotal', value: 13, retired: true, before: 7 });
		const [line] = linesOf([set], 18);
		expect(line).toMatchObject({ retired: true, canRemove: false, verb: 'Changed 7 to 13' });
	});

	it('gives Remove only to the user who can click the row', () => {
		expect(linesOf([click()], 7, true)[0].canRemove).toBe(true);
		expect(linesOf([click()], 7, false)[0].canRemove).toBe(false);
	});
});

describe('resultSumText of a natural 20', () => {
	const nat20 = (value: number) => click({ change: 'countsAsNat20', value, stat: '' });

	it('tells why the total changed', () => {
		expect(resultSumText(1, [nat20(19)])).toBe(`Rolled 1, counts as 20 ${MINUS} 1 = 19`);
		expect(resultSumText(1, [nat20(20)])).toBe('Rolled 1, counts as 20 + 0 = 20');
		expect(resultSumText(0, [nat20(19)])).toBe(`Rolled 0, counts as 20 ${MINUS} 1 = 19`);
	});

	it('writes a roll below zero with a true minus', () => {
		expect(resultSumText(-1, [nat20(18)])).toBe(`Rolled ${MINUS}1, counts as 20 ${MINUS} 2 = 18`);
	});

	it('takes a later add on the same sum', () => {
		expect(resultSumText(1, [nat20(19), click()])).toBe(
			`Rolled 1, counts as 20 ${MINUS} 1 + 3 = 22`,
		);
	});
});

describe('resultSumText', () => {
	it('is empty when the total is the roll', () => {
		expect(resultSumText(7, [])).toBeNull();
		expect(resultSumText(7, [click({ change: 'succeed', value: 0 })])).toBeNull();
		expect(resultSumText(7, [click({ change: 'setTotal', value: 7 })])).toBeNull();
	});

	it('adds each click', () => {
		expect(resultSumText(7, [click(), click()])).toBe('7 + 3 + 3 = 13');
	});

	it('shows a negative add with a true minus sign', () => {
		expect(resultSumText(7, [click({ value: -1 })])).toBe(`7 ${MINUS} 1 = 6`);
	});

	it('tells a set total in words', () => {
		expect(resultSumText(7, [click({ change: 'setTotal', value: 13 })])).toBeNull();
	});

	it('keeps the order of mixed changes', () => {
		expect(resultSumText(7, [click({ change: 'setTotal', value: 10 }), click()])).toBe(
			'7 changed to 10 + 3 = 13',
		);
		expect(resultSumText(7, [click(), click({ change: 'setTotal', value: 13 })])).toBe(
			'7 + 3 = 10 changed to 13',
		);
	});

	it('starts from the new roll and leaves out retired changes', () => {
		const retired = click({ retired: true, before: 7 });
		expect(resultSumText(11, [retired])).toBeNull();
		expect(resultSumText(11, [retired, click()])).toBe('11 + 3 = 14');
	});
});
