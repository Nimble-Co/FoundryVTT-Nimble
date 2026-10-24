/**
 * A DamageRoll saved on a chat card and rebuilt from that data keeps its
 * Primary Die: the rebuilt roll reads the same Primary Die result.
 */

import { describe, expect, test } from 'vitest';

interface RebuiltDamageRoll {
	primaryDieValue?: number;
	primaryDie?: unknown;
	evaluate(): Promise<unknown>;
	toJSON(): object;
}

type DamageRollClass = (new (
	formula: string,
	data?: object,
	options?: object,
) => RebuiltDamageRoll) & { fromData(data: object): RebuiltDamageRoll };

describe('DamageRoll saved and rebuilt', () => {
	test('keeps the Primary Die result', async () => {
		const DamageRoll = CONFIG.Dice.rolls.find(
			(cls) => cls.name === 'DamageRoll',
		) as unknown as DamageRollClass;
		const PrimaryDie = (CONFIG.Dice.termTypes as Record<string, unknown>).PrimaryDie as
			| (abstract new (
					...args: never[]
			  ) => unknown)
			| undefined;

		for (const formula of ['1d8+2', '2d6', '1d12']) {
			const roll = new DamageRoll(formula, {}, { canCrit: true, canMiss: true });
			await roll.evaluate();
			const rebuilt = DamageRoll.fromData(foundry.utils.deepClone(roll.toJSON()));

			expect(rebuilt.primaryDieValue).toBe(roll.primaryDieValue);
			expect(typeof rebuilt.primaryDieValue).toBe('number');
			expect(PrimaryDie).toBeDefined();
			expect(rebuilt.primaryDie).toBeInstanceOf(PrimaryDie as abstract new () => unknown);
		}
	});
});
