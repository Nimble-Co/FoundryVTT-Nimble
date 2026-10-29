import { describe, expect, it } from 'vitest';
import { toggleDie } from '../diceSelection.ts';

describe('toggleDie', () => {
	it('adds a die, and takes it away on a second click', () => {
		expect(toggleDie([], 2, null)).toEqual([2]);
		expect(toggleDie([2, 0], 2, null)).toEqual([0]);
	});

	it('has no limit when the cap is null', () => {
		expect(toggleDie([0, 1, 2], 3, null)).toEqual([0, 1, 2, 3]);
	});

	it('drops the oldest pick at the cap', () => {
		expect(toggleDie([0], 1, 1)).toEqual([1]);
		expect(toggleDie([0, 1], 2, 2)).toEqual([1, 2]);
	});
});
