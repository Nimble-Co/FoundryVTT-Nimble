import type { NimbleRollData } from '#types/rollData.d.ts';

/** Roll data type for deterministic bonus calculation. */
type DeterministicBonusRollData = NimbleRollData;

/**
 * Calculates the deterministic (static) bonus value from a roll formula.
 *
 * This function evaluates a formula synchronously to determine its total numeric value.
 * It's useful for:
 * - Calculating flat bonuses from formulas like "@abilities.str.mod + 2"
 * - Resolving attribute references to their actual numeric values
 * - Validating that a formula produces a valid result
 *
 * The function handles various edge cases:
 * - Returns `null` for null/undefined formulas
 * - Returns `0` for empty strings or zero values
 * - Shows an error notification and returns `null` for invalid formulas
 *
 * @param formula - A roll formula (string) or numeric value to evaluate.
 * @param rollData - Actor data used to resolve attribute references (e.g., `@abilities.str.mod`).
 * @param options - Evaluation options.
 * @param options.strict - If true, throws on invalid formulas instead of returning null.
 * @returns The calculated numeric bonus, or `null` if the formula is invalid.
 *
 * @example
 * ```typescript
 * // Simple numeric formula
 * getDeterministicBonus("5 + 3"); // 8
 *
 * // With actor data
 * const bonus = getDeterministicBonus("@abilities.str.mod + 2", actor.getRollData());
 *
 * // Returns null for invalid formulas
 * getDeterministicBonus("invalid formula"); // null (with error notification)
 * ```
 */
export default function getDeterministicBonus(
	formula: string | number,
	rollData: DeterministicBonusRollData = {},
	options: { strict?: boolean } = {},
): number | null {
	if (formula === null || formula === undefined) return null;
	if (typeof formula === 'string' && formula.trim() === '') return 0;
	if (typeof formula === 'number' && formula === 0) return 0;

	const formulaString = typeof formula === 'number' ? formula.toString() : formula;

	const optionSet = {
		...options,
		strict: options.strict ?? false,
	};

	let roll: Roll<DeterministicBonusRollData>;

	try {
		roll = new Roll<DeterministicBonusRollData>(formulaString, rollData);
		if (!Roll.validate(roll.formula)) throw Error('Invalid roll formula');
	} catch (_error) {
		ui.notifications?.error(`Invalid roll formula: ${formulaString}`);
		return null;
	}

	const result = roll.evaluateSync({ strict: optionSet.strict });
	return result.total ?? 0;
}
