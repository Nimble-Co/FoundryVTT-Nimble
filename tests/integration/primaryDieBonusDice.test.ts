/**
 * "Add to Primary Die Result" and the Primary Die Bonus rule roll the Primary
 * Die before the roll is evaluated. That die must come from Foundry's dice, as
 * every other die does. The page's random source is replaced, so the die is known.
 */

import { afterEach, describe, expect, test } from 'vitest';

interface LiveRoll {
	terms: Array<{ results?: Array<{ result: number }> }>;
	total: number;
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

describe('Primary Die with a bonus on live dice', () => {
	test.each([1, 2, 4])('a d6 that rolls %i gets the +1 on that face', async (face) => {
		CONFIG.Dice.randomUniform = () => 1 - (face - 0.5) / 6;
		const roll = new (DamageRoll())(
			'1d6 + 2',
			{},
			{
				canCrit: true,
				canMiss: true,
				rollMode: 0,
				primaryDieValue: 0,
				primaryDieModifier: 1,
			},
		);
		await roll.evaluate({ allowInteractive: false });

		expect(roll.options.primaryDieBaseResult).toBe(face);
		expect(roll.terms[0].results?.[0]?.result).toBe(face + 1);
		expect(roll.total).toBe(face + 1 + 2);
	});
});
