import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPrimaryDieBreakdown } from '../../view/chat/components/RollSummary.svelte.ts';
import { DamageRoll } from '../DamageRoll.js';
import { changeOneDie, rerollOneDie } from '../oneDieReroll.js';
import type { PrimaryDie } from '../terms/PrimaryDie.js';

const PRIMARY = { term: 0, result: 0 };

/** An evaluated 1d6 attack that rolled `rolled`, with "Add to Primary Die Result" +1. */
function attack(rolled: number): DamageRoll {
	const roll = new DamageRoll(
		'1d6+1',
		{},
		{ canCrit: true, canMiss: true, rollMode: 0, primaryDieValue: 0, primaryDieModifier: 1 },
	);
	const die = roll.primaryDie as PrimaryDie;
	die.results = [{ result: Math.min(6, rolled + 1), active: true }];
	die.options.rolledFace = rolled;
	Object.assign(die, { _evaluated: true });
	roll.options.primaryDieBaseResult = rolled;
	Object.assign(roll, { _evaluated: true, _evaluateASTSync: () => 0 });
	return roll;
}

const breakdown = (roll: DamageRoll) =>
	getPrimaryDieBreakdown({ rollOptions: { ...roll.options }, roll: roll as never })?.text ?? null;

const draws = (...values: number[]) => {
	const queue = [...values];
	return async () => queue.shift() ?? 1;
};

describe('a Change a Die set on a Primary Die with a bonus', () => {
	beforeEach(() => {
		(CONFIG.Dice as unknown as { parser: unknown }).parser = { toAST: () => null };
	});

	afterEach(() => {
		vi.restoreAllMocks();
		delete (CONFIG.Dice as unknown as { parser?: unknown }).parser;
	});

	/** The change and the reroll work on the roll itself, not on a copy. */
	function inPlace(roll: DamageRoll) {
		vi.spyOn(foundry.dice.Roll, 'fromData').mockImplementation(((data: { class?: string }) =>
			data.class === 'Roll' ? data : roll) as never);
	}

	it('makes a set 1 the final face: a miss, with no breakdown line', async () => {
		const roll = attack(4);
		inPlace(roll);
		expect(breakdown(roll)).toBe('Primary Die: 4 + 1 = 5');

		await changeOneDie(roll, PRIMARY, { mode: 'set', value: 1 });

		expect(roll.primaryDie?.results[0].result).toBe(1);
		expect(roll.isMiss).toBe(true);
		expect(roll.options.primaryDieBonusOff).toBe(true);
		expect(breakdown(roll)).toBeNull();
	});

	it('makes a set max a crit', async () => {
		const roll = attack(2);
		inPlace(roll);

		await changeOneDie(roll, PRIMARY, { mode: 'set', value: 6 }, { draw: draws(3) });

		expect(roll.primaryDie?.results[0].result).toBe(6);
		expect(roll.isCritical).toBe(true);
	});

	it('adds the bonus when the change says so', async () => {
		const roll = attack(2);
		inPlace(roll);

		await changeOneDie(roll, PRIMARY, { mode: 'set', value: 5, addsBonus: true });

		expect(roll.primaryDie?.results[0].result).toBe(6);
		expect(roll.options.primaryDieBonusOff).toBeUndefined();
		expect(breakdown(roll)).toBe('Primary Die: 5 + 1 = 6');
	});

	it('gives the bonus back to a reroll of the die', async () => {
		const roll = attack(4);
		inPlace(roll);
		await changeOneDie(roll, PRIMARY, { mode: 'set', value: 2 });

		await rerollOneDie(roll, PRIMARY, { draw: draws(3) });

		expect(roll.primaryDie?.results[0].result).toBe(4);
		expect(roll.options.primaryDieBonusOff).toBeUndefined();
		expect(breakdown(roll)).toBe('Primary Die: 3 + 1 = 4');
	});

	it('moves the face an add finds, and still shows no breakdown line', async () => {
		const roll = attack(4);
		inPlace(roll);
		await changeOneDie(roll, PRIMARY, { mode: 'set', value: 2 });

		await changeOneDie(roll, PRIMARY, { mode: 'add', value: 1 });

		expect(roll.primaryDie?.results[0].result).toBe(3);
		expect(roll.options.primaryDieBonusOff).toBe(true);
		expect(breakdown(roll)).toBeNull();
	});

	it('puts the bonus back with a later set that adds it', async () => {
		const roll = attack(4);
		inPlace(roll);
		await changeOneDie(roll, PRIMARY, { mode: 'set', value: 2 });

		await changeOneDie(roll, PRIMARY, { mode: 'set', value: 4, addsBonus: true });

		expect(roll.primaryDie?.results[0].result).toBe(5);
		expect(breakdown(roll)).toBe('Primary Die: 4 + 1 = 5');
	});
});
