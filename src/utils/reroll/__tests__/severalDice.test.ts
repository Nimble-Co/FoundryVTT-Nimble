import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { costForDice, type UseCost } from '../../cost/useCost.js';
import { severalDiceFor } from '../rerollDieChoice.js';
import type { RerollableRoll } from '../rerollRollTarget.js';

const die = (result: number) => ({ result, active: true });

function rollWith(faces: number[][]) {
	return {
		terms: faces.map((results) => ({
			faces: 6,
			number: results.length,
			results: results.map(die),
		})),
		options: {},
		toJSON() {
			return { terms: this.terms };
		},
	};
}

function found(current: unknown) {
	return {
		current: () => current,
		replaced: {},
		previousResult: null,
	} as unknown as RerollableRoll<unknown>;
}

const step = (roll: ReturnType<typeof rollWith>, ref: { term: number; result: number }) => {
	const copy = rollWith(roll.terms.map((term) => term.results.map((r) => r.result)));
	const previous = copy.terms[ref.term].results[ref.result].result;
	copy.terms[ref.term].results[ref.result].result = 6;
	return Promise.resolve({
		roll: copy,
		faces: 6,
		previous,
		next: 6,
		dropped: null,
		thrown: { toJSON: () => ({ formula: '1d6', terms: [{}] }), total: 6 },
	});
};

describe('a reroll of several dice', () => {
	beforeEach(() => {
		vi.spyOn(foundry.dice.Roll, 'fromData').mockImplementation(((data: object) => data) as never);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('rerolls each die the player picked, and only those, one after the other', async () => {
		const current = rollWith([[3], [2, 4]]);
		const target = severalDiceFor(
			found(current),
			[
				{ term: 0, result: 0 },
				{ term: 1, result: 1 },
			],
			step as never,
		);

		const next = (await target?.makeRoll('', {})) as ReturnType<typeof rollWith>;

		expect(next.terms.map((term) => term.results.map((r) => r.result))).toEqual([[6], [2, 6]]);
		expect(current.terms[0].results[0].result).toBe(3);
		expect(target?.readNewDie?.(next)).toMatchObject({
			several: [
				{ faces: 6, previous: 3, next: 6 },
				{ faces: 6, previous: 4, next: 6 },
			],
		});
	});

	it('throws all the new dice together', async () => {
		const target = severalDiceFor(
			found(rollWith([[3], [2]])),
			[
				{ term: 0, result: 0 },
				{ term: 1, result: 0 },
			],
			step as never,
		);
		const next = await target?.makeRoll('', {});

		expect(target?.diceToThrow?.(next)).toMatchObject({ formula: '1d6 + 1d6', total: 12 });
	});

	it('refuses a die the roll does not have', () => {
		expect(
			severalDiceFor(found(rollWith([[3]])), [{ term: 4, result: 0 }], step as never),
		).toBeNull();
	});
});

describe('a cost per die', () => {
	const cost: UseCost = {
		chargePoolIdentifier: '',
		chargeCost: 1,
		manaCost: 1,
		woundCost: 0,
		heroicReaction: '',
		actionCost: 0,
	};

	it('counts the dice', () => {
		expect(costForDice({ ...cost, perDie: true }, 3).manaCost).toBe(3);
	});

	it('stays the same with no per die cost', () => {
		expect(costForDice(cost, 3).manaCost).toBe(1);
	});
});
