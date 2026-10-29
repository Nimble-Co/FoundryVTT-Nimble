/**
 * A one-die reroll and a one-die change on real Foundry dice: the keep,
 * explode, crit and miss modifiers run as Foundry runs them. The page's random
 * source is replaced, so every die is known.
 */

import { afterEach, describe, expect, test } from 'vitest';
import { changeOneDie, primaryDieRef, rerollOneDie } from '../../src/dice/oneDieReroll.ts';

interface LiveResult {
	result: number;
	active?: boolean;
	discarded?: boolean;
	exploded?: boolean;
}

interface LiveRoll {
	terms: Array<{ faces?: number; results?: LiveResult[] }>;
	total: number;
	isCritical?: boolean;
	isMiss?: boolean;
	critCount?: number;
	primaryDie?: unknown;
	options: Record<string, unknown>;
	evaluate(options?: object): Promise<unknown>;
	toJSON(): object;
}

type LiveRollClass = new (formula: string, data?: object, options?: object) => LiveRoll;

const rollClass = (name: string) =>
	CONFIG.Dice.rolls.find((cls) => cls.name === name) as unknown as LiveRollClass;

const originalRandom = CONFIG.Dice.randomUniform;

/** The next dice roll these values, each on a die of `faces`. */
function nextDice(faces: number, ...values: number[]) {
	const queue = [...values];
	CONFIG.Dice.randomUniform = () => {
		const value = queue.shift();
		if (value === undefined) throw new Error('The test ran out of dice.');
		return 1 - (value - 0.5) / faces;
	};
}

async function rolled(
	cls: string,
	formula: string,
	options: object,
	faces: number,
	values: number[],
) {
	nextDice(faces, ...values);
	const roll = new (rollClass(cls))(formula, {}, options);
	await roll.evaluate({ allowInteractive: false });
	return roll;
}

const resultsOf = (roll: LiveRoll, term = 0) =>
	(roll.terms[term].results ?? []).map((r) => (r.active === false ? `(${r.result})` : r.result));

const DAMAGE = {
	canCrit: true,
	canMiss: true,
	rollMode: 0,
	primaryDieValue: 0,
	primaryDieModifier: 0,
};

afterEach(() => {
	CONFIG.Dice.randomUniform = originalRandom;
});

describe('rerollOneDie on live dice', () => {
	test('a crit Primary Die rerolled below max loses its explosion and the crit', async () => {
		const roll = await rolled('DamageRoll', '1d8 + 2', DAMAGE, 8, [8, 3]);
		expect([roll.total, roll.isCritical]).toEqual([13, true]);

		nextDice(8, 4);
		const ref = primaryDieRef(roll as never);
		const done = await rerollOneDie(roll as never, ref ?? { term: 0, result: 0 });
		const after = done.roll as unknown as LiveRoll;

		expect(resultsOf(after)).toEqual([4]);
		expect([after.total, after.isCritical, after.isMiss]).toEqual([6, false, false]);
		expect([done.previous, done.next, done.faces]).toEqual([8, 4, 8]);
		expect(resultsOf(roll)).toEqual([8, 3]);
	});

	test.each([
		[1, 6, 2],
		[-1, 2, 6],
	])(
		'with roll mode change %i the die is rolled two times and one result stays',
		async (rollModeChange, kept, dropped) => {
			const roll = await rolled('DamageRoll', '1d8 + 2', DAMAGE, 8, [4]);

			nextDice(8, 2, 6);
			const done = await rerollOneDie(roll as never, { term: 0, result: 0 }, { rollModeChange });
			const after = done.roll as unknown as LiveRoll;

			expect(resultsOf(after)).toEqual([kept]);
			expect([done.next, done.dropped]).toEqual([kept, dropped]);
			expect(after.total).toBe(kept + 2);
		},
	);

	test('a Primary Die rerolled to its max explodes and crits', async () => {
		const roll = await rolled('DamageRoll', '1d8 + 2', DAMAGE, 8, [1]);
		expect(roll.isMiss).toBe(true);

		nextDice(8, 8, 5);
		const done = await rerollOneDie(roll as never, { term: 0, result: 0 });
		const after = done.roll as unknown as LiveRoll;

		expect(resultsOf(after)).toEqual([8, 5]);
		expect([after.total, after.isCritical, after.isMiss]).toEqual([15, true, false]);
		expect(
			(done.thrown.terms[0] as unknown as { results: LiveResult[] }).results.map((r) => r.result),
		).toEqual([8, 5]);
	});

	test('a Primary Die rerolled gets Add to Primary Die Result again, and the damage past its max is worked out again', async () => {
		const options = { ...DAMAGE, primaryDieValue: 4, primaryDieModifier: 5 };
		const roll = await rolled('DamageRoll', '1d6 + 2', options, 6, [2]);
		expect(resultsOf(roll)).toEqual([6, 2]);
		expect([roll.total, roll.isCritical]).toEqual([13, true]);

		nextDice(6, 3, 1);
		const done = await rerollOneDie(roll as never, { term: 0, result: 0 });
		const after = done.roll as unknown as LiveRoll;

		expect(resultsOf(after)).toEqual([6, 1]);
		expect([after.total, after.isCritical, after.isMiss]).toEqual([11, true, false]);
		expect([done.previous, done.next]).toEqual([6, 6]);
		expect(after.options.primaryDieBaseResult).toBe(3);
		expect(after.options.primaryDieValue).toBeUndefined();

		nextDice(6, 1, 2);
		const exact = (await rerollOneDie(after as never, { term: 0, result: 0 }))
			.roll as unknown as LiveRoll;

		expect(resultsOf(exact)).toEqual([6, 2]);
		expect([exact.total, exact.isCritical]).toEqual([10, true]);
		expect(exact.options.primaryDieBaseResult).toBe(1);
	});

	test('a pool die of a damage roll changes only the total', async () => {
		const roll = await rolled('DamageRoll', '2d6', DAMAGE, 6, [3, 2]);
		const poolIndex = roll.terms.findIndex((term, index) => index > 0 && term.faces === 6);

		nextDice(6, 5);
		const after = (await rerollOneDie(roll as never, { term: poolIndex, result: 0 }))
			.roll as unknown as LiveRoll;

		expect(after.total).toBe(8);
		expect(after.isCritical).toBe(false);
	});

	test('a vicious chain die rerolled below max ends the chain', async () => {
		const options = { ...DAMAGE, explosionStyle: 'vicious' };
		const roll = await rolled('DamageRoll', '1d8 + 2', options, 8, [8, 8, 3, 2, 5]);
		expect(resultsOf(roll)).toEqual([8, 8, 3, 2, 5]);

		nextDice(8, 1);
		const after = (await rerollOneDie(roll as never, { term: 0, result: 1 }))
			.roll as unknown as LiveRoll;

		expect(resultsOf(after)).toEqual([8, 1, 3]);
		expect([after.total, after.isCritical]).toEqual([14, true]);
	});

	test('a c die explodes, and a reroll below max takes the crit away', async () => {
		const roll = await rolled('DamageRoll', '2d4c + 1', DAMAGE, 4, [4, 2, 1]);
		expect(resultsOf(roll)).toEqual([4, 2, 1]);
		expect([roll.total, roll.critCount]).toEqual([8, 1]);

		nextDice(4, 3);
		const after = (await rerollOneDie(roll as never, { term: 0, result: 0 }))
			.roll as unknown as LiveRoll;

		expect(resultsOf(after)).toEqual([3, 2]);
		expect([after.total, after.isCritical, after.critCount]).toEqual([6, false, 0]);
	});

	test('the dropped d20 of a check, rerolled higher, becomes the kept one', async () => {
		const roll = await rolled('NimbleRoll', '2d20khn + 3', {}, 20, [15, 4]);
		expect(roll.total).toBe(18);

		nextDice(20, 19);
		const after = (await rerollOneDie(roll as never, { term: 0, result: 1 }))
			.roll as unknown as LiveRoll;

		expect(resultsOf(after)).toEqual(['(15)', 19]);
		expect(after.total).toBe(22);
	});

	test('the new die and its explosion die come from the dice fulfillment, as manual entry does', async () => {
		const roll = await rolled('DamageRoll', '1d6 + 2', DAMAGE, 6, [2]);
		const methods = CONFIG.Dice.fulfillment.methods as Record<string, unknown>;
		const settingKey = 'diceConfiguration';
		const before = game.settings.get('core', settingKey as never) as Record<string, string>;
		const entered = [6, 3];
		methods.nimbleTest = { label: 'Test', interactive: false, handler: () => entered.shift() };
		await game.settings.set('core', settingKey as never, { ...before, d6: 'nimbleTest' } as never);
		CONFIG.Dice.randomUniform = () => {
			throw new Error('A digital die was rolled.');
		};
		try {
			const ref = primaryDieRef(roll as never);
			if (!ref) throw new Error('no Primary Die');
			const result = await rerollOneDie(roll as never, ref);

			expect(entered).toEqual([]);
			expect(result.next).toBe(6);
			expect((result.roll as unknown as LiveRoll).total).toBe(11);
		} finally {
			await game.settings.set('core', settingKey as never, before as never);
			delete methods.nimbleTest;
		}
	});
});

describe('changeOneDie on live dice', () => {
	const primary = (roll: LiveRoll) => {
		const ref = primaryDieRef(roll as never);
		if (!ref) throw new Error('no Primary Die');
		return ref;
	};

	test('a Primary Die set to its max explodes and crits, and only the new dice are thrown', async () => {
		const roll = await rolled('DamageRoll', '1d8 + 2', DAMAGE, 8, [3]);

		nextDice(8, 5);
		const done = await changeOneDie(roll as never, primary(roll), { mode: 'set', value: 8 });
		const after = done.roll as unknown as LiveRoll;

		expect(resultsOf(after)).toEqual([8, 5]);
		expect([after.total, after.isCritical, after.isMiss]).toEqual([15, true, false]);
		expect([done.previous, done.next, done.faces]).toEqual([3, 8, 8]);
		expect(done.thrown).not.toBeNull();
		expect(resultsOf(roll)).toEqual([3]);
	});

	test('a crit Primary Die set below its max loses its explosion and the crit, and throws nothing', async () => {
		const roll = await rolled('DamageRoll', '1d8 + 2', DAMAGE, 8, [8, 3]);

		CONFIG.Dice.randomUniform = () => {
			throw new Error('A die was rolled.');
		};
		const done = await changeOneDie(roll as never, primary(roll), { mode: 'set', value: 4 });
		const after = done.roll as unknown as LiveRoll;

		expect(resultsOf(after)).toEqual([4]);
		expect([after.total, after.isCritical, after.isMiss]).toEqual([6, false, false]);
		expect(done.thrown).toBeNull();
	});

	test('a Primary Die set to 1 is a miss', async () => {
		const roll = await rolled('DamageRoll', '1d8 + 2', DAMAGE, 8, [5]);
		CONFIG.Dice.randomUniform = () => {
			throw new Error('A die was rolled.');
		};

		const after = (await changeOneDie(roll as never, primary(roll), { mode: 'set', value: 1 }))
			.roll as unknown as LiveRoll;

		expect(resultsOf(after)).toEqual([1]);
		expect(after.isMiss).toBe(true);
	});

	test('a Primary Die set to the miss threshold of the attack is a miss', async () => {
		const roll = await rolled('DamageRoll', '1d8 + 2', { ...DAMAGE, missThreshold: 2 }, 8, [6]);

		const after = (await changeOneDie(roll as never, primary(roll), { mode: 'set', value: 2 }))
			.roll as unknown as LiveRoll;

		expect(resultsOf(after)).toEqual([2]);
		expect(after.isMiss).toBe(true);
	});

	test('a set value is final: Add to Primary Die Result is not added, and a later reroll adds it again', async () => {
		const options = { ...DAMAGE, primaryDieModifier: 1 };
		const roll = await rolled('DamageRoll', '1d8 + 2', options, 8, [3]);
		expect(resultsOf(roll)).toEqual([4]);

		const done = await changeOneDie(roll as never, primary(roll), { mode: 'set', value: 6 });
		const after = done.roll as unknown as LiveRoll;

		expect(resultsOf(after)).toEqual([6]);
		expect([after.total, done.bonusNotAdded]).toEqual([8, 1]);

		nextDice(8, 2);
		const again = (await rerollOneDie(after as never, primary(after))).roll as unknown as LiveRoll;
		expect(resultsOf(again)).toEqual([3]);
	});

	test('an add change adds to the die, up to its max', async () => {
		const roll = await rolled('DamageRoll', '1d8 + 2', DAMAGE, 8, [3]);

		const done = await changeOneDie(roll as never, primary(roll), { mode: 'add', value: 1 });
		const after = done.roll as unknown as LiveRoll;

		expect(resultsOf(after)).toEqual([4]);
		expect([after.total, done.bonusNotAdded]).toEqual([6, 0]);
	});

	test('a kept d20 of a check set lower stays the kept one: the keep rule does not run again', async () => {
		const roll = await rolled('NimbleRoll', '2d20khn + 3', {}, 20, [15, 4]);

		const after = (
			await changeOneDie(roll as never, { term: 0, result: 0 }, { mode: 'set', value: 2 })
		).roll as unknown as LiveRoll;

		expect(resultsOf(after)).toEqual([2, '(4)']);
		expect(after.total).toBe(5);
	});
});
