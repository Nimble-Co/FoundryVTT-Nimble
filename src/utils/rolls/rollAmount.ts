import { showDiceAnimation } from '#utils/rolls/showDiceAnimation.js';

export interface RolledAmount {
	/** The total, rounded down, never below 0. 0 when the formula does not roll. */
	amount: number;
	roll: Roll.Any | null;
}

/**
 * Roll a formula for an amount, such as damage. `purpose` ends the warning when the formula does
 * not roll ("of a turn"); `show` shows the dice.
 */
export async function rollAmount(
	formula: string,
	rollData: Record<string, unknown>,
	{ purpose, show = false }: { purpose: string; show?: boolean },
): Promise<RolledAmount> {
	if (!formula) return { amount: 0, roll: null };
	try {
		const roll = new Roll(formula, rollData);
		await roll.evaluate();
		if (show) await showDiceAnimation(roll);
		const total = Math.floor(Number(roll.total));
		return { amount: Number.isFinite(total) && total > 0 ? total : 0, roll };
	} catch (error) {
		console.warn(`Nimble | Could not roll the damage "${formula}" ${purpose}.`, error);
		return { amount: 0, roll: null };
	}
}
