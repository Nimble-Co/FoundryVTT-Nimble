import { afterEach, describe, expect, it } from 'vitest';
import type { ResultChange } from '#types/resultChange.d.ts';
import { checkResultOfCard } from '../checkResult.js';
import {
	naturalResultChange,
	newResultChange,
	resultChangesOf,
	resultTotal,
	retireResultChanges,
	standingResultChanges,
} from '../resultChanges.js';

function change(overrides: Partial<ResultChange> = {}): ResultChange {
	return {
		id: 'click',
		lineId: 'click',
		entryId: 'entry',
		itemUuid: 'Item.soul',
		ruleId: 'rule',
		label: 'Soul',
		actorUuid: 'Actor.a',
		change: 'add',
		value: 3,
		stat: 'strength',
		retired: false,
		before: null,
		chargePoolIdentifier: '',
		paid: { charges: 0, mana: 0, wounds: 0 },
		...overrides,
	};
}

const succeed = change({ change: 'succeed', value: 0, stat: '' });
const setTo = (value: number) => change({ change: 'setTotal', value, stat: '' });

function roll(d20: number, total: number) {
	return { total, terms: [{ faces: 20, results: [{ result: d20, active: true }] }] };
}

function saveResult(system: Record<string, unknown>, d20 = 5, total = 7) {
	return checkResultOfCard('savingThrow', { saveKey: 'will', ...system }, roll(d20, total));
}

describe('resultTotal', () => {
	it('is the roll with no changes, as on an old card', () => {
		expect(resultChangesOf({})).toEqual([]);
		expect(resultTotal(7, [])).toBe(7);
	});

	it('works the changes out in order', () => {
		expect(resultTotal(7, [change(), setTo(10), change()])).toBe(13);
		expect(resultTotal(7, [setTo(10), change()])).toBe(13);
		expect(resultTotal(7, [change(), setTo(10)])).toBe(10);
	});

	it('takes a negative add off the total', () => {
		expect(resultTotal(7, [change({ value: -1 })])).toBe(6);
	});

	it('does not change the total for a succeed', () => {
		expect(resultTotal(7, [succeed])).toBe(7);
	});

	it('works the total out again with a change gone, the others in their order', () => {
		const add = change({ id: 'a' });
		const set = { ...setTo(10), id: 'b' };
		const last = change({ id: 'c' });
		expect(resultTotal(7, [add, set, last])).toBe(13);
		expect(resultTotal(7, [add, last])).toBe(13);
		expect(resultTotal(7, [set, last])).toBe(13);
		expect(resultTotal(7, [add, set])).toBe(10);
	});

	it('does not count a retired change', () => {
		expect(resultTotal(9, [change({ retired: true, before: 7 })])).toBe(9);
	});
});

describe('a change that counts as a natural 20', () => {
	const nat20 = change({ change: 'countsAsNat20', value: 19, stat: '' });

	it('sets the total, and later adds go on it', () => {
		expect(resultTotal(1, [nat20])).toBe(19);
		expect(resultTotal(1, [nat20, change()])).toBe(22);
	});

	it('succeeds on a save with no DC and over a DC it does not meet', () => {
		expect(saveResult({ resultChanges: [nat20] }, 2, 1)).toBe('succeeded');
		expect(saveResult({ dc: 25, resultChanges: [nat20] }, 2, 1)).toBe('succeeded');
	});

	it('succeeds on a skill check, and stops when a new roll retires it', () => {
		const roll2 = roll(2, 1);
		const system = { skillKey: 'insight', dc: 15, resultChanges: [nat20] };
		expect(checkResultOfCard('skillCheck', system, roll2)).toBe('succeeded');
		const retired = { ...system, resultChanges: [{ ...nat20, retired: true }] };
		expect(checkResultOfCard('skillCheck', retired, roll2)).toBe('failed');
	});
});

describe('naturalResultChange', () => {
	const WILL = { kind: 'save', key: 'will' } as const;
	const rule = {
		id: 'rule-1',
		label: '',
		item: { name: 'Bumblewise', uuid: 'Item.bumble' },
		countsAsNat20On: (roll: { kind: string; key?: string }) => roll.key === 'will',
	};
	const roller = { uuid: 'Actor.hero', rules: [{ type: 'reroll' }, rule] };
	const gameGlobal = globalThis as unknown as { game: { settings?: unknown } };

	afterEach(() => {
		gameGlobal.game.settings = { get: () => true };
	});

	it('makes a free automatic change at 1 or less: 20 plus the modifier', () => {
		const made = naturalResultChange({ roller, roll: WILL, rollTotal: 1, keptD20: 2 });
		expect(made).toMatchObject({
			change: 'countsAsNat20',
			value: 19,
			automatic: true,
			itemUuid: 'Item.bumble',
			ruleId: 'rule-1',
			actorUuid: 'Actor.hero',
			label: 'Bumblewise',
			retired: false,
			paid: { charges: 0, mana: 0, wounds: 0 },
		});
		expect(made?.lineId).toBe(made?.id);
	});

	it('reads a modifier of 0 and a total under 1', () => {
		expect(naturalResultChange({ roller, roll: WILL, rollTotal: 1, keptD20: 1 })?.value).toBe(20);
		expect(naturalResultChange({ roller, roll: WILL, rollTotal: -2, keptD20: 1 })?.value).toBe(17);
	});

	it('makes none over 1, with no rule that covers the roll, or with no d20', () => {
		expect(naturalResultChange({ roller, roll: WILL, rollTotal: 2, keptD20: 3 })).toBeNull();
		const other = { kind: 'save', key: 'strength' } as const;
		expect(naturalResultChange({ roller, roll: other, rollTotal: 1, keptD20: 1 })).toBeNull();
		expect(naturalResultChange({ roller, roll: WILL, rollTotal: 1, keptD20: null })).toBeNull();
		expect(naturalResultChange({ roller: null, roll: WILL, rollTotal: 1, keptD20: 1 })).toBeNull();
	});

	it('makes none with Feature Effects off: it is a row then', () => {
		gameGlobal.game.settings = { get: () => false };
		expect(naturalResultChange({ roller, roll: WILL, rollTotal: 1, keptD20: 1 })).toBeNull();
	});
});

describe('retireResultChanges', () => {
	it('retires the standing changes and keeps the total each one replaced', () => {
		const old = change({ id: 'old', retired: true, before: 2 });
		const retired = retireResultChanges(7, [old, change({ id: 'a' }), { ...setTo(13), id: 'b' }]);

		expect(retired[0]).toBe(old);
		expect(retired[1]).toMatchObject({ retired: true, before: 7 });
		expect(retired[2]).toMatchObject({ retired: true, before: 10 });
		expect(standingResultChanges(retired)).toEqual([]);
	});
});

describe('newResultChange of no damage', () => {
	it('names the target it covers', () => {
		const made = newResultChange({
			entry: {
				id: 'e',
				itemUuid: 'Item.res',
				ruleId: 'r',
				label: 'Res',
				actorUuid: 'A',
				targetTokenUuid: 'Token.a',
			},
			use: { change: 'noDamage', value: 0, stat: '' },
			changes: [],
			chargePoolIdentifier: 'res',
			paid: { charges: 1, mana: 0, wounds: 0 },
		});
		expect(made.targetTokenUuid).toBe('Token.a');
		expect(resultTotal(9, [made])).toBe(9);
	});
});

describe('newResultChange', () => {
	const entry = { id: 'e', itemUuid: 'Item.soul', ruleId: 'rule', label: 'Soul', actorUuid: 'A' };
	const paid = { charges: 0, mana: 0, wounds: 1 };
	const add = { change: 'add', value: 3, stat: 'strength' } as const;

	function click(
		changes: ResultChange[] = [],
		use: Parameters<typeof newResultChange>[0]['use'] = add,
	) {
		return newResultChange({ entry, use, changes, chargePoolIdentifier: '', paid });
	}

	it('starts a line of its own', () => {
		const first = click();
		expect(first.lineId).toBe(first.id);
	});

	it('grows the line of the same add that stands', () => {
		const first = click();
		const second = click([first]);
		expect(second.id).not.toBe(first.id);
		expect(second.lineId).toBe(first.id);
	});

	it('starts a new line after a new roll retired the old one', () => {
		const first = { ...click(), retired: true };
		expect(click([first]).lineId).not.toBe(first.id);
	});

	it('does not join the add of another rule', () => {
		const other = { ...click(), ruleId: 'other' };
		expect(click([other]).lineId).not.toBe(other.id);
	});

	it('does not join a line when it is no add', () => {
		const first = click();
		const set = click([first], { change: 'setTotal', value: 10, stat: '' });
		expect(set.lineId).toBe(set.id);
	});
});

describe('checkResultOfCard with changes', () => {
	it('reads a known DC against the total with the changes on it', () => {
		expect(saveResult({ dc: 13 })).toBe('failed');
		expect(saveResult({ dc: 13, resultChanges: [change()] })).toBe('failed');
		expect(saveResult({ dc: 13, resultChanges: [change(), change()] })).toBe('succeeded');
		expect(saveResult({ dc: 13, resultChanges: [setTo(13)] })).toBe('succeeded');
	});

	it('fails again when a negative add takes the total below the DC', () => {
		expect(saveResult({ dc: 7 })).toBe('succeeded');
		expect(saveResult({ dc: 7, resultChanges: [change({ value: -1 })] })).toBe('failed');
	});

	it('succeeds with a succeed, with or without a DC', () => {
		expect(saveResult({ resultChanges: [succeed] })).toBe('succeeded');
		expect(saveResult({ dc: 14, resultChanges: [succeed] })).toBe('succeeded');
	});

	it('reads the card again when a change is gone or retired', () => {
		expect(saveResult({ dc: 14, resultChanges: [] })).toBe('failed');
		expect(saveResult({ dc: 14, resultChanges: [{ ...succeed, retired: true }] })).toBe('failed');
	});

	it('tells no result with no DC and no natural 1 or 20', () => {
		expect(saveResult({ resultChanges: [change()] })).toBeNull();
	});

	it('keeps a natural 1 failed and a natural 20 succeeded through an add', () => {
		expect(saveResult({ dc: 5, resultChanges: [change()] }, 1, 4)).toBe('failed');
		expect(saveResult({ dc: 30, resultChanges: [change()] }, 20, 23)).toBe('succeeded');
	});

	it('reads no natural under a set total, which replaced the roll', () => {
		expect(saveResult({ dc: 10, resultChanges: [setTo(13)] }, 1, 4)).toBe('succeeded');
		expect(saveResult({ dc: 30, resultChanges: [setTo(13)] }, 20, 23)).toBe('failed');
		expect(saveResult({ resultChanges: [setTo(13)] }, 1, 4)).toBeNull();
	});

	it('lets a succeed win over a natural 1', () => {
		expect(saveResult({ dc: 5, resultChanges: [succeed] }, 1, 4)).toBe('succeeded');
	});
});
