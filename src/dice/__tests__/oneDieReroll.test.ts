import { describe, expect, it } from 'vitest';
import { pickableDice, primaryDieRef } from '../oneDieReroll.js';
import type { DieTermLike } from '../rerollDieInTerm.js';

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
