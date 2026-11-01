import { describe, expect, it } from 'vitest';
import type { ResultChange } from '#types/resultChange.d.ts';
import { getInitiativeStartingActions } from '../../combat/initiativeStartingActions.js';
import { checkResultOfCard } from '../checkResult.js';
import { startingActionsAfterUse, startingActionsOfCard } from '../initiativeCard.js';

function roll(d20: number, total: number) {
	return { total, terms: [{ faces: 20, results: [{ result: d20, active: true }] }] };
}

function change(overrides: Partial<ResultChange>): ResultChange {
	return { change: 'add', value: 0, stat: '', retired: false, ...overrides } as ResultChange;
}

describe('getInitiativeStartingActions', () => {
	it.each([
		[1, 1],
		[9, 1],
		[10, 2],
		[19, 2],
		[20, 3],
		[25, 3],
	])('a total of %i gives %i', (total, actions) => {
		expect(getInitiativeStartingActions(total)).toBe(actions);
	});

	it('a natural 20 gives 3 with any total', () => {
		expect(getInitiativeStartingActions(18, 20)).toBe(3);
		expect(getInitiativeStartingActions(5, 20)).toBe(3);
	});

	it('another kept die gives what the total gives', () => {
		expect(getInitiativeStartingActions(19, 19)).toBe(2);
	});
});

describe('startingActionsOfCard', () => {
	it('reads the derived total', () => {
		expect(startingActionsOfCard(roll(5, 7), [])).toBe(1);
		expect(startingActionsOfCard(roll(5, 7), [change({ change: 'setTotal', value: 10 })])).toBe(2);
		expect(startingActionsOfCard(roll(5, 7), [change({ value: 13 })])).toBe(3);
	});

	it('a natural 20 counts, and still counts through an add', () => {
		expect(startingActionsOfCard(roll(20, 19), [])).toBe(3);
		expect(startingActionsOfCard(roll(20, 19), [change({ value: -2 })])).toBe(3);
	});

	it('a set total replaces the roll, so no natural 20 is left', () => {
		expect(startingActionsOfCard(roll(20, 19), [change({ change: 'setTotal', value: 10 })])).toBe(
			2,
		);
	});
});

describe('startingActionsAfterUse', () => {
	it('tells what one more use gives, and does not change the card', () => {
		const changes: ResultChange[] = [];
		const use = { change: 'setTotal', value: 10, stat: '' } as const;

		expect(startingActionsAfterUse(roll(5, 7), changes, use)).toBe(2);
		expect(changes).toEqual([]);
	});
});

describe('checkResultOfCard on an Initiative card', () => {
	it.each([
		[20, 22],
		[1, 3],
		[5, 7],
	])('has no result on a %i', (d20, total) => {
		expect(checkResultOfCard('initiative', {}, roll(d20, total))).toBeNull();
	});
});
