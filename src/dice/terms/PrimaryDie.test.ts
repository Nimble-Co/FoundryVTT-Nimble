import { describe, expect, it } from 'vitest';
import { PrimaryDie } from './PrimaryDie.ts';

type MockResult = {
	result: number;
	active: boolean;
	discarded?: boolean;
	exploded?: boolean;
};

function makeDie(results: MockResult[], evaluated = true): PrimaryDie {
	const die = new PrimaryDie({ faces: 6 });
	(die as unknown as { results: MockResult[]; _evaluated: boolean }).results = results;
	(die as unknown as { _evaluated: boolean })._evaluated = evaluated;
	return die;
}

describe('PrimaryDie', () => {
	describe('exploded', () => {
		it('should return undefined when not yet evaluated', () => {
			const die = makeDie([{ result: 6, active: true, exploded: true }], false);
			expect(die.exploded).toBeUndefined();
		});

		it('should return true when any result has exploded: true', () => {
			const die = makeDie([{ result: 6, active: true, exploded: true }]);
			expect(die.exploded).toBe(true);
		});

		it('should return false when no results have exploded: true', () => {
			const die = makeDie([{ result: 4, active: true }]);
			expect(die.exploded).toBe(false);
		});

		it('should return false when exploded is false on all results', () => {
			const die = makeDie([
				{ result: 6, active: true, exploded: false },
				{ result: 3, active: true, exploded: false },
			]);
			expect(die.exploded).toBe(false);
		});

		it('should return true when at least one result has exploded: true among many', () => {
			const die = makeDie([
				{ result: 6, active: false, exploded: true },
				{ result: 2, active: true, exploded: false },
			]);
			expect(die.exploded).toBe(true);
		});
	});

	describe('isMiss', () => {
		it('should return undefined when not yet evaluated', () => {
			const die = makeDie([{ result: 1, active: true }], false);
			expect(die.isMiss).toBeUndefined();
		});

		it('should return true when result is 1, active, not discarded, not exploded', () => {
			const die = makeDie([{ result: 1, active: true, discarded: false, exploded: false }]);
			expect(die.isMiss).toBe(true);
		});

		it('should return true when result is 1 and active with no discarded/exploded fields set', () => {
			const die = makeDie([{ result: 1, active: true }]);
			expect(die.isMiss).toBe(true);
		});

		it('should return false when result is 1 but exploded is true (exploded 1 is not a miss)', () => {
			const die = makeDie([{ result: 1, active: true, discarded: false, exploded: true }]);
			expect(die.isMiss).toBe(false);
		});

		it('should return false when result is 1 but discarded is true', () => {
			const die = makeDie([{ result: 1, active: true, discarded: true }]);
			expect(die.isMiss).toBe(false);
		});

		it('should return false when result is 1 but active is false', () => {
			const die = makeDie([{ result: 1, active: false }]);
			expect(die.isMiss).toBe(false);
		});

		it('should return false when result is above 1', () => {
			const die = makeDie([{ result: 3, active: true }]);
			expect(die.isMiss).toBe(false);
		});

		it('should return false when no results have result === 1', () => {
			const die = makeDie([
				{ result: 4, active: true },
				{ result: 6, active: true },
			]);
			expect(die.isMiss).toBe(false);
		});
	});
});
