import { describe, expect, it } from 'vitest';
import type { ResultChange } from '#utils/incomingReactions/incomingReactionEntry.ts';
import { resultAmount, resultChangeLines, resultSumText } from '../resultChangeLines.ts';

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

describe('resultChangeLines', () => {
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
		expect(resultSumText(7, [click({ change: 'setTotal', value: 13 })])).toBe('7 changed to 13');
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
