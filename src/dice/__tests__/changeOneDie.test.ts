import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { changeOneDie, type OneDieRoll } from '../oneDieReroll.js';

type Result = { result: number; active?: boolean; discarded?: boolean; exploded?: boolean };

type FakeRoll = OneDieRoll & {
	terms: Array<{ faces: number; number: number; modifiers: string[]; results: Result[] }>;
	refreshOutcome: Mock<() => void>;
	primaryDieChanged: Mock<(term: unknown, base: number, bonusOnFace?: boolean) => void>;
	primaryDieBonusOf?: () => { add: number; base: number } | null;
	options?: { primaryDieBonusOff?: boolean };
};

let copies: FakeRoll[] = [];
let copyBonus: { add: number; base: number } | null = null;
let copyBonusOff = false;

/** A roll whose copy is a plain object with the same dice. */
function fakeRoll(results: Result[], modifiers: string[] = [], number = 1): FakeRoll {
	const roll = {
		terms: [{ faces: 8, number, modifiers, results }],
		toJSON: () => ({ class: 'DamageRoll', terms: structuredClone(roll.terms) }),
		refreshOutcome: vi.fn<() => void>(),
		primaryDieChanged: vi.fn<(term: unknown, base: number, bonusOnFace?: boolean) => void>(),
		primaryDieBonusOf: () => copyBonus,
		options: { primaryDieBonusOff: copyBonusOff },
	};
	return roll as unknown as FakeRoll;
}

const draws = (...values: number[]) => {
	const queue = [...values];
	return async () => queue.shift() ?? 1;
};

describe('changeOneDie', () => {
	beforeEach(() => {
		copies = [];
		vi.spyOn(foundry.dice.Roll, 'fromData').mockImplementation(((data: {
			class: string;
			terms: FakeRoll['terms'];
		}) => {
			if (data.class !== 'DamageRoll') return data;
			const copy = fakeRoll([]);
			copy.terms = data.terms;
			copies.push(copy);
			return copy;
		}) as never);
	});

	afterEach(() => {
		vi.restoreAllMocks();
		copyBonus = null;
		copyBonusOff = false;
	});

	describe('with a Primary Die bonus of +1', () => {
		beforeEach(() => {
			copyBonus = { add: 1, base: 3 };
		});

		const addsBonus = { mode: 'set', addsBonus: true } as const;

		it('puts the bonus on a set value that adds it, and records the face before it', async () => {
			const roll = fakeRoll([{ result: 4, active: true }]);

			const changed = await changeOneDie(roll, { term: 0, result: 0 }, { ...addsBonus, value: 5 });

			expect([changed.previous, changed.next]).toEqual([4, 6]);
			expect(copies[0].primaryDieChanged).toHaveBeenCalledWith(copies[0].terms[0], 5, true);
		});

		it('stops a set value with the bonus at the max', async () => {
			const roll = fakeRoll([{ result: 4, active: true }]);

			const changed = await changeOneDie(
				roll,
				{ term: 0, result: 0 },
				{ ...addsBonus, value: 8 },
				{ draw: draws(2) },
			);

			expect(changed.next).toBe(8);
			expect(copies[0].primaryDieChanged).toHaveBeenCalledWith(copies[0].terms[0], 8, true);
		});

		it('makes a set value the final face when the change does not add the bonus', async () => {
			const roll = fakeRoll([{ result: 4, active: true }]);

			const changed = await changeOneDie(roll, { term: 0, result: 0 }, { mode: 'set', value: 5 });

			expect(changed.next).toBe(5);
			expect(copies[0].primaryDieChanged).toHaveBeenCalledWith(copies[0].terms[0], 5, false);
		});

		it('keeps a set 1 at 1 and a set max at the max, with no bonus', async () => {
			const ref = { term: 0, result: 0 };
			const low = await changeOneDie(fakeRoll([{ result: 4, active: true }]), ref, {
				mode: 'set',
				value: 1,
			});
			const high = await changeOneDie(fakeRoll([{ result: 4, active: true }]), ref, {
				mode: 'set',
				value: 8,
			});

			expect(low.next).toBe(1);
			expect(high.next).toBe(8);
		});

		it('moves the face on an add, which already holds the bonus', async () => {
			const roll = fakeRoll([{ result: 4, active: true }]);

			const changed = await changeOneDie(roll, { term: 0, result: 0 }, { mode: 'add', value: 1 });

			expect(changed.next).toBe(5);
			expect(copies[0].primaryDieChanged).toHaveBeenCalledWith(copies[0].terms[0], 4, true);
		});

		it('moves the face on an add after a set with no bonus, and puts no bonus on it', async () => {
			copyBonusOff = true;
			const roll = fakeRoll([{ result: 1, active: true }]);

			const changed = await changeOneDie(roll, { term: 0, result: 0 }, { mode: 'add', value: 2 });

			expect(changed.next).toBe(3);
			expect(copies[0].primaryDieChanged).toHaveBeenCalledWith(copies[0].terms[0], 3, false);
		});

		it('puts the bonus back on with a set that adds it, after a set with no bonus', async () => {
			copyBonusOff = true;
			const roll = fakeRoll([{ result: 1, active: true }]);

			const changed = await changeOneDie(roll, { term: 0, result: 0 }, { ...addsBonus, value: 5 });

			expect(changed.next).toBe(6);
			expect(copies[0].primaryDieChanged).toHaveBeenCalledWith(copies[0].terms[0], 5, true);
		});

		it('gives an explosion die no bonus and leaves the Primary Die options alone', async () => {
			const roll = fakeRoll(
				[
					{ result: 8, active: true, exploded: true },
					{ result: 3, active: true },
				],
				['x'],
			);

			const changed = await changeOneDie(roll, { term: 0, result: 1 }, { ...addsBonus, value: 5 });

			expect(changed.next).toBe(5);
			expect(copies[0].primaryDieChanged).not.toHaveBeenCalled();
		});
	});

	it('sets the die to the face, works the outcome out again, and rolls nothing', async () => {
		const roll = fakeRoll([{ result: 3, active: true }]);

		const changed = await changeOneDie(roll, { term: 0, result: 0 }, { mode: 'set', value: 6 });

		expect(changed).toMatchObject({
			faces: 8,
			previous: 3,
			next: 6,
			thrown: null,
		});
		expect(changed.roll.terms[0]).toMatchObject({ results: [{ result: 6, active: true }] });
		expect(copies[0].refreshOutcome).toHaveBeenCalled();
		expect(copies[0].primaryDieChanged).toHaveBeenCalledWith(copies[0].terms[0], 6, false);
		expect(roll.terms[0].results[0].result).toBe(3);
	});

	it('keeps a set value between 1 and the max', async () => {
		const high = await changeOneDie(
			fakeRoll([{ result: 3 }]),
			{ term: 0, result: 0 },
			{
				mode: 'set',
				value: 12,
			},
		);
		const low = await changeOneDie(
			fakeRoll([{ result: 3 }]),
			{ term: 0, result: 0 },
			{
				mode: 'set',
				value: 0,
			},
		);
		expect(high.next).toBe(8);
		expect(low.next).toBe(1);
	});

	it('adds to the shown face, between 1 and the max', async () => {
		const ref = { term: 0, result: 0 };
		expect(
			(await changeOneDie(fakeRoll([{ result: 3 }]), ref, { mode: 'add', value: 2 })).next,
		).toBe(5);
		expect(
			(await changeOneDie(fakeRoll([{ result: 7 }]), ref, { mode: 'add', value: 2 })).next,
		).toBe(8);
		expect(
			(await changeOneDie(fakeRoll([{ result: 1 }]), ref, { mode: 'add', value: -1 })).next,
		).toBe(1);
	});

	it('rolls the dice a new max explodes into, and throws only those', async () => {
		const changed = await changeOneDie(
			fakeRoll([{ result: 3, active: true }], ['x']),
			{ term: 0, result: 0 },
			{ mode: 'set', value: 8 },
			{ draw: draws(5) },
		);
		expect(changed.roll.terms[0]).toMatchObject({
			results: [{ result: 8, exploded: true }, { result: 5 }],
		});
		expect(changed.thrown).toMatchObject({ formula: '1d8' });
	});

	it('does not touch the Primary Die options for a dropped die', async () => {
		await changeOneDie(
			fakeRoll(
				[
					{ result: 6, active: true },
					{ result: 2, active: false, discarded: true },
				],
				['khn'],
				2,
			),
			{ term: 0, result: 1 },
			{ mode: 'set', value: 7 },
		);
		expect(copies[0].primaryDieChanged).not.toHaveBeenCalled();
	});
});
