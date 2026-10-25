import { describe, expect, it } from 'vitest';
import { type DieTermLike, pickableDice, primaryDieRef, rerollDieInTerm } from './oneDieReroll.js';

type Result = DieTermLike['results'][number];

function kept(result: number, extra: Partial<Result> = {}): Result {
	return { result, active: true, ...extra };
}

function dropped(result: number): Result {
	return { result, active: false, discarded: true };
}

function term(
	faces: number,
	number: number,
	results: Result[],
	modifiers: string[] = [],
): DieTermLike {
	return { faces, number, modifiers, results };
}

/** Draws these values in order. */
function draws(...values: number[]) {
	const queue = [...values];
	return async () => {
		const value = queue.shift();
		if (value === undefined) throw new Error('No draw left');
		return value;
	};
}

const values = (die: DieTermLike) => die.results.map((r) => r.result);

describe('rerollDieInTerm', () => {
	it('changes only the picked die of a plain pool', async () => {
		const die = term(6, 3, [kept(2), kept(5), kept(1)]);

		const changed = await rerollDieInTerm(die, 1, 'none', draws(4));

		expect(changed).toEqual({ previous: 5, next: 4, drawn: [4] });
		expect(die.results).toEqual([kept(2), kept(4), kept(1)]);
	});

	it('keeps the highest again after a kept die of an advantage pool changes', async () => {
		const die = term(8, 2, [dropped(3), kept(7)], ['khn']);

		await rerollDieInTerm(die, 1, 'standard', draws(2));

		expect(die.results).toEqual([
			{ result: 3, active: true, discarded: false },
			{ result: 2, active: false, discarded: true },
		]);
	});

	it('drops the explosion dice of a die that no longer rolls its max', async () => {
		const die = term(8, 1, [kept(8, { exploded: true }), kept(5)], ['x']);

		await rerollDieInTerm(die, 0, 'standard', draws(4));

		expect(die.results).toEqual([kept(4)]);
	});

	it('rolls new explosion dice when the new result is a max', async () => {
		const die = term(8, 1, [kept(8, { exploded: true }), kept(5)], ['x']);

		const changed = await rerollDieInTerm(die, 0, 'standard', draws(8, 3));

		expect(changed.drawn).toEqual([8, 3]);
		expect(die.results).toEqual([kept(8, { exploded: true }), kept(3)]);
	});

	it('explodes a newly rolled max on a die that did not explode before', async () => {
		const die = term(6, 2, [kept(2), kept(4)], ['x']);

		await rerollDieInTerm(die, 1, 'standard', draws(6, 6, 1));

		expect(values(die)).toEqual([2, 6, 6, 1]);
		expect(die.results[1].exploded).toBe(true);
		expect(die.results[2].exploded).toBe(true);
	});

	it('keeps the explosion dice of the other dice in their places', async () => {
		const die = term(
			8,
			2,
			[kept(8, { exploded: true }), kept(8, { exploded: true }), kept(5), kept(3)],
			['x'],
		);

		await rerollDieInTerm(die, 2, 'standard', draws(8, 4));

		// Root 0 -> 8 -> 4, root 1 -> 3, in the order Foundry appends them.
		expect(values(die)).toEqual([8, 8, 8, 3, 4]);
	});

	it('rerolls an explosion die, and drops only the dice it made', async () => {
		const die = term(
			8,
			1,
			[kept(8, { exploded: true }), kept(8, { exploded: true }), kept(2)],
			['x'],
		);

		await rerollDieInTerm(die, 1, 'standard', draws(6));

		expect(die.results).toEqual([kept(8, { exploded: true }), kept(6)]);
	});

	it('explodes a dropped die that a reroll makes the kept one', async () => {
		const die = term(8, 2, [dropped(8), kept(8, { exploded: true }), kept(4)], ['khn', 'x']);

		await rerollDieInTerm(die, 1, 'standard', draws(2, 6));

		expect(die.results).toEqual([
			{ result: 8, active: true, discarded: false, exploded: true },
			{ result: 2, active: false, discarded: true },
			kept(6),
		]);
	});

	it('drops the explosion dice of a die that a reroll drops', async () => {
		const die = term(8, 2, [kept(8, { exploded: true }), dropped(3), kept(4)], ['khn', 'x']);

		await rerollDieInTerm(die, 1, 'standard', draws(8, 2));

		expect(die.results).toEqual([
			{ result: 8, active: false, discarded: true },
			{ result: 8, active: true, discarded: false, exploded: true },
			kept(2),
		]);
	});

	describe('a vicious die', () => {
		const chain = (value: number, extra: Partial<Result> = {}) =>
			kept(value, { provenance: 'viciousChain', ...extra });
		const bonus = (value: number) => kept(value, { provenance: 'viciousBonus' });

		function viciousDie() {
			return term(8, 1, [
				kept(8, { exploded: true }),
				chain(8, { exploded: true }),
				bonus(3),
				chain(2),
				bonus(5),
			]);
		}

		it('drops the whole chain when the base die no longer rolls its max', async () => {
			const die = viciousDie();

			await rerollDieInTerm(die, 0, 'vicious', draws(4));

			expect(die.results).toEqual([kept(4)]);
		});

		it('never explodes the bonus die', async () => {
			const die = viciousDie();

			await rerollDieInTerm(die, 2, 'vicious', draws(8));

			expect(values(die)).toEqual([8, 8, 8, 2, 5]);
		});

		it('ends the chain at a chain die that no longer rolls its max', async () => {
			const die = viciousDie();

			await rerollDieInTerm(die, 1, 'vicious', draws(1));

			expect(die.results).toEqual([kept(8, { exploded: true }), chain(1), bonus(3)]);
		});

		it('rolls two new dice for a base die that rolls its max again', async () => {
			const die = term(8, 1, [kept(3)]);

			await rerollDieInTerm(die, 0, 'vicious', draws(8, 6, 2));

			expect(die.results).toEqual([kept(8, { exploded: true }), chain(6), bonus(2)]);
		});
	});

	it('refuses a die the term does not have', async () => {
		await expect(rerollDieInTerm(term(6, 1, [kept(2)]), 3, 'none', draws(1))).rejects.toThrow(
			'no result 3',
		);
	});
});

describe('pickableDice', () => {
	const op = { operator: '+' };

	it('lists the Primary Die, its explosion dice and the other dice that count, not the dropped ones', () => {
		const primary = term(8, 2, [dropped(2), kept(8, { exploded: true }), kept(3)], ['khn', 'x']);
		const pool = term(6, 2, [kept(4), kept(1)]);

		expect(pickableDice({ terms: [primary, op, pool], primaryDie: primary })).toEqual([
			{ term: 0, result: 1, faces: 8, value: 8, role: 'primary' },
			{ term: 0, result: 2, faces: 8, value: 3, role: 'explosion' },
			{ term: 2, result: 0, faces: 6, value: 4, role: 'kept' },
			{ term: 2, result: 1, faces: 6, value: 1, role: 'kept' },
		]);
	});

	it('lists the dropped dice of the term it is told to', () => {
		const d20 = term(20, 2, [kept(15), dropped(4)], ['khn']);

		expect(pickableDice({ terms: [d20, op, { number: 3 }] }, { droppedFrom: 0 })).toEqual([
			{ term: 0, result: 0, faces: 20, value: 15, role: 'kept' },
			{ term: 0, result: 1, faces: 20, value: 4, role: 'dropped' },
		]);
	});
});

describe('primaryDieRef', () => {
	it("points at the kept result of the roll's Primary Die", () => {
		const primary = term(8, 2, [dropped(2), kept(6)], ['khn']);
		expect(primaryDieRef({ terms: [{ number: 1 }, primary], primaryDie: primary })).toEqual({
			term: 1,
			result: 1,
		});
	});

	it('points at the kept d20 of a check', () => {
		const d20 = term(20, 2, [dropped(3), kept(11)], ['khn']);
		expect(primaryDieRef({ terms: [d20] })).toEqual({ term: 0, result: 1 });
	});

	it('gives nothing for a roll without dice', () => {
		expect(primaryDieRef({ terms: [{ number: 4 }] })).toBeNull();
	});
});
