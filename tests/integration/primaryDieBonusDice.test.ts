/**
 * "Add to Primary Die Result" and the Primary Die Bonus rule add to the face of
 * the Primary Die, from 1 up to its max. Foundry rolls the die; the face with
 * the bonus decides crit, miss and explosion. The part past the max is lost.
 * The page's random source is replaced, so every die is known.
 */

import { afterEach, describe, expect, test } from 'vitest';

interface LiveRoll {
	terms: Array<{ results?: Array<{ result: number }> }>;
	total: number;
	isCritical?: boolean;
	isMiss?: boolean;
	options: Record<string, unknown>;
	evaluate(options?: object): Promise<unknown>;
}

type LiveRollClass = new (formula: string, data?: object, options?: object) => LiveRoll;

const DamageRoll = () =>
	CONFIG.Dice.rolls.find((cls) => cls.name === 'DamageRoll') as unknown as LiveRollClass;

const originalRandom = CONFIG.Dice.randomUniform;

afterEach(() => {
	CONFIG.Dice.randomUniform = originalRandom;
});

async function rolledWithBonus(faces: number[], options: object = {}) {
	const queue = [...faces];
	CONFIG.Dice.randomUniform = () => {
		const face = queue.shift();
		if (face === undefined) throw new Error('The test ran out of dice.');
		return 1 - (face - 0.5) / 6;
	};
	const roll = new (DamageRoll())(
		'1d6 + 2',
		{},
		{
			canCrit: true,
			canMiss: true,
			rollMode: 0,
			primaryDieValue: 0,
			primaryDieModifier: 1,
			...options,
		},
	);
	await roll.evaluate({ allowInteractive: false });
	return roll;
}

const faces = (roll: LiveRoll) => (roll.terms[0].results ?? []).map((r) => r.result);

describe('Primary Die with a bonus on live dice', () => {
	test('a rolled 2 shows 3, and the roll records the face before the bonus', async () => {
		const roll = await rolledWithBonus([2]);

		expect([faces(roll), roll.total, roll.isCritical, roll.isMiss]).toEqual([[3], 5, false, false]);
		expect(roll.options.primaryDieBaseResult).toBe(2);
	});

	test('a rolled 5 becomes the max: a crit that explodes', async () => {
		const roll = await rolledWithBonus([5, 3]);

		expect([faces(roll), roll.total, roll.isCritical]).toEqual([[6, 3], 11, true]);
	});

	test('a rolled 6 stays 6: the +1 is lost, and it still crits', async () => {
		const roll = await rolledWithBonus([6, 3]);

		expect([faces(roll), roll.total, roll.isCritical]).toEqual([[6, 3], 11, true]);
	});

	test('a rolled 1 becomes 2, so it does not miss', async () => {
		const roll = await rolledWithBonus([1]);

		expect([faces(roll), roll.isMiss]).toEqual([[2], false]);
	});

	test('with advantage the die that stays gets the bonus', async () => {
		const roll = await rolledWithBonus([2, 4], { rollMode: 1 });

		expect(roll.terms[0].results?.find((r) => (r as { active?: boolean }).active)?.result).toBe(5);
		expect(roll.total).toBe(7);
	});

	test('a set value gets the bonus too', async () => {
		const roll = await rolledWithBonus([2], { primaryDieValue: 4 });

		expect([faces(roll), roll.total]).toEqual([[5], 7]);
	});
});
