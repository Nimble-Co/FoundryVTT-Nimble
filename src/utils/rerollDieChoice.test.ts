import { describe, expect, it, vi } from 'vitest';
import type { OneDieRoll } from '../dice/oneDieReroll.js';
import { diceToPick, rerollableFor } from './rerollDieChoice.js';
import type { RerollableRoll } from './rerollRollTarget.js';

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
			thrown: 'thrown' as never,
		}));
		const current = damageRoll();
		const one = rerollableFor(found(current), 'primaryDie', null, reroll);
		if (!one) throw new Error('expected a reroll');

		expect(one.previousResult).toBe(6);
		expect(await one.makeRoll('ignored', {})).toBe('one die');
		expect(reroll).toHaveBeenCalledWith(current, { term: 0, result: 1 });
		expect(one.readNewDie?.('one die')).toEqual({ faces: 8, value: 3 });
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
