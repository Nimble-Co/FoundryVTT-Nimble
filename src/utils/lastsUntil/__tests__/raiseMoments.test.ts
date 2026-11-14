import { describe, expect, it } from 'vitest';
import type { Moment } from '../momentReached.js';
import { raisableNumber, raiseMoments } from '../raiseMoments.js';

const blank: Moment = {
	kind: 'turn',
	boundary: 'end',
	clock: 'holder',
	span: 'nextTurn',
	value: null,
	units: null,
	who: null,
	event: null,
	effectName: '',
};

const turn = (fields: Partial<Moment> = {}): Moment => ({ ...blank, ...fields });
const time = (value: number | null): Moment => ({
	...blank,
	kind: 'time',
	boundary: null,
	clock: null,
	span: null,
	value,
	units: 'minutes',
});
const combatEnd: Moment = {
	...blank,
	kind: 'event',
	boundary: null,
	clock: null,
	span: null,
	event: 'combatEnd',
};

describe('raiseMoments', () => {
	it('counts a next turn with no count as the 1st', () => {
		expect(raiseMoments([turn()], [{ index: 0, amount: 2 }])).toEqual([turn({ value: 3 })]);
	});

	it('adds to the count of a 2nd next turn', () => {
		expect(raiseMoments([turn({ value: 2 })], [{ index: 0, amount: 6 }])).toEqual([
			turn({ value: 8 }),
		]);
	});

	it('adds to a time', () => {
		expect(raiseMoments([time(1)], [{ index: 0, amount: 1 }])).toEqual([time(2)]);
		expect(raiseMoments([time(null)], [{ index: 0, amount: 1 }])).toEqual([time(2)]);
	});

	it('raises only the moment at the index', () => {
		const moments = [turn(), time(1)];

		expect(raiseMoments(moments, [{ index: 1, amount: 2 }])).toEqual([turn(), time(3)]);
	});

	it('leaves a moment with no number as it is', () => {
		const moments = [
			combatEnd,
			turn({ span: 'currentTurn' }),
			turn({ span: 'nextRound', clock: null }),
			turn({ clock: 'nextHero' }),
		];
		const raises = moments.map((_, index) => ({ index, amount: 2 }));

		expect(raiseMoments(moments, raises)).toEqual(moments);
	});

	it('gives the same moments with no raises, and an index that is not there changes nothing', () => {
		const moments = [turn()];

		expect(raiseMoments(moments, [])).toBe(moments);
		expect(raiseMoments(moments, [{ index: 4, amount: 2 }])).toEqual(moments);
	});
});

describe('raisableNumber', () => {
	it('gives the number of a counted turn and of a time, and null for the others', () => {
		expect(raisableNumber(turn())).toBe(1);
		expect(raisableNumber(turn({ value: 3 }))).toBe(3);
		expect(raisableNumber(time(10))).toBe(10);
		expect(raisableNumber(combatEnd)).toBeNull();
		expect(raisableNumber(turn({ span: 'currentTurn' }))).toBeNull();
		expect(raisableNumber(turn({ clock: 'nextHero' }))).toBeNull();
	});
});
