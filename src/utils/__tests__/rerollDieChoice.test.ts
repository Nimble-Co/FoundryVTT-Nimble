import { afterEach, describe, expect, it, vi } from 'vitest';
import { type OneDieRoll, rerollOneDie } from '../../dice/oneDieReroll.js';
import { diceToPick, rerollableFor } from '../rerollDieChoice.js';
import type { RerollableRoll } from '../rerollRollTarget.js';

const kept = (result: number) => ({ result, active: true });
const dropped = (result: number) => ({ result, active: false, discarded: true });

function damageRoll(): OneDieRoll & { primaryDie: unknown } {
	const primary = { faces: 8, number: 2, modifiers: ['khn'], results: [dropped(2), kept(6)] };
	return {
		terms: [primary, { operator: '+' }, { faces: 6, number: 1, results: [kept(4)] }],
		primaryDie: primary,
		toJSON: () => ({}),
	};
}

function checkRoll(): OneDieRoll {
	return {
		terms: [{ faces: 20, number: 2, modifiers: ['khn'], results: [kept(15), dropped(4)] }],
		toJSON: () => ({}),
	};
}

function found(current: OneDieRoll | null, extra: Partial<RerollableRoll<string>> = {}) {
	return {
		slot: 'slot',
		replaced: {},
		previousResult: 99,
		makeRoll: vi.fn(async () => 'whole roll'),
		prepare: vi.fn(),
		current: () => current,
		...extra,
	} as RerollableRoll<string>;
}

describe('rerollableFor', () => {
	it('rerolls the whole roll by default', () => {
		const whole = found(damageRoll());
		expect(rerollableFor(whole, 'wholeRoll')).toBe(whole);
		expect(rerollableFor(whole, undefined)).toBe(whole);
	});

	it('rerolls the kept Primary Die, and reads its new result', async () => {
		const reroll = vi.fn(async () => ({
			roll: 'one die' as never,
			faces: 8,
			previous: 6,
			next: 3,
			dropped: null,
			thrown: 'thrown' as never,
		}));
		const current = damageRoll();
		const one = rerollableFor(found(current), 'primaryDie', null, reroll);
		if (!one) throw new Error('expected a reroll');

		expect(one.previousResult).toBe(6);
		expect(await one.makeRoll('ignored', {})).toBe('one die');
		expect(reroll).toHaveBeenCalledWith(current, { term: 0, result: 1 }, { rollModeChange: 0 });
		expect(one.readNewDie?.('one die')).toEqual({ faces: 8, value: 3, dropped: null });
		expect(one.diceToThrow?.('one die')).toBe('thrown');
	});

	it('rerolls the die the player picked, if the player can pick it', () => {
		const roll = damageRoll();
		expect(rerollableFor(found(roll), 'pickedDie', { term: 2, result: 0 })?.previousResult).toBe(4);
		expect(rerollableFor(found(roll), 'pickedDie', { term: 0, result: 0 })).toBeNull();
		expect(rerollableFor(found(roll), 'pickedDie', { term: 1, result: 0 })).toBeNull();
	});

	it('needs a pick when more than one die can be picked', () => {
		expect(rerollableFor(found(damageRoll()), 'pickedDie', null)).toBeNull();
	});

	it('takes the only die there is without a pick', () => {
		const single: OneDieRoll = {
			terms: [{ faces: 20, number: 1, results: [kept(9)] }],
			toJSON: () => ({}),
		};
		expect(rerollableFor(found(single), 'pickedDie', null)?.previousResult).toBe(9);
	});

	it("lets a player pick a check's dropped d20", () => {
		const check = found(checkRoll(), { pickDropped: true });
		expect(rerollableFor(check, 'pickedDie', { term: 0, result: 1 })?.previousResult).toBe(4);
		expect(rerollableFor(found(checkRoll()), 'pickedDie', { term: 0, result: 1 })).toBeNull();
	});

	it('cannot reroll one die of a roll it cannot rebuild', () => {
		expect(rerollableFor(found(null), 'primaryDie')).toBeNull();
	});
});

describe('diceToPick', () => {
	it('lists the dice a player can pick on the card', () => {
		expect(diceToPick(found(checkRoll(), { pickDropped: true })).map((d) => d.role)).toEqual([
			'kept',
			'dropped',
		]);
		expect(diceToPick(found(null))).toEqual([]);
	});
});

describe('rerollableFor with a roll mode change on the reroll', () => {
	afterEach(() => vi.restoreAllMocks());

	// The copy rerollOneDie makes of the card's roll: same dice, its outcome worked out again.
	function copyRolls() {
		vi.spyOn(foundry.dice.Roll, 'fromData').mockImplementation(
			(data: unknown) =>
				({
					...(data as object),
					toJSON: () => data,
					refreshOutcome: () => undefined,
				}) as never,
		);
	}

	function draws(...values: number[]) {
		const queue = [...values];
		return vi.fn(async () => {
			const value = queue.shift();
			if (value === undefined) throw new Error('no more draws');
			return value;
		});
	}

	function d6(results: Array<{ result: number; active: boolean }>, modifiers: string[] = []) {
		const terms = [{ faces: 6, number: 1, modifiers, results }];
		return { terms, toJSON: () => ({ terms: structuredClone(terms) }) } as OneDieRoll;
	}

	function withDraws(draw: ReturnType<typeof draws>) {
		return ((roll: OneDieRoll, ref: { term: number; result: number }, options?: object) =>
			rerollOneDie(roll, ref, { ...options, draw })) as typeof rerollOneDie;
	}

	it('rolls the die two times with advantage and keeps the higher', async () => {
		copyRolls();
		const draw = draws(2, 5);
		const one = rerollableFor(found(d6([kept(3)])), 'pickedDie', null, withDraws(draw));
		if (!one) throw new Error('expected a reroll');

		const roll = await one.makeRoll('ignored', {}, { rollModeChange: 1 });

		expect((roll as unknown as OneDieRoll).terms[0]).toMatchObject({ results: [kept(5)] });
		expect(one.readNewDie?.(roll)).toEqual({ faces: 6, value: 5, dropped: 2 });
	});

	it('keeps the lower with disadvantage', async () => {
		copyRolls();
		const one = rerollableFor(found(d6([kept(3)])), 'pickedDie', null, withDraws(draws(2, 5)));
		if (!one) throw new Error('expected a reroll');

		const roll = await one.makeRoll('ignored', {}, { rollModeChange: -1 });

		expect(one.readNewDie?.(roll)).toEqual({ faces: 6, value: 2, dropped: 5 });
	});

	it('rolls the die once with no change', async () => {
		copyRolls();
		const draw = draws(4);
		const one = rerollableFor(found(d6([kept(3)])), 'pickedDie', null, withDraws(draw));
		if (!one) throw new Error('expected a reroll');

		const roll = await one.makeRoll('ignored', {});

		expect(draw).toHaveBeenCalledTimes(1);
		expect(one.readNewDie?.(roll)).toEqual({ faces: 6, value: 4, dropped: null });
	});

	it('rolls only the picked die two times, not the dice its max explodes into', async () => {
		copyRolls();
		const draw = draws(1, 6, 3);
		const one = rerollableFor(found(d6([kept(2)], ['x'])), 'pickedDie', null, withDraws(draw));
		if (!one) throw new Error('expected a reroll');

		const roll = await one.makeRoll('ignored', {}, { rollModeChange: 1 });

		expect(draw).toHaveBeenCalledTimes(3);
		expect((roll as unknown as OneDieRoll).terms[0]).toMatchObject({
			results: [
				{ result: 6, active: true, exploded: true },
				{ result: 3, active: true },
			],
		});
		expect(one.readNewDie?.(roll)).toEqual({ faces: 6, value: 6, dropped: 1 });
	});
});
