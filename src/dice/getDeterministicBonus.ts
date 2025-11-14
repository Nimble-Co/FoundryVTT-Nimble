/**
 * A helper function for determining the deterministic bonus given a formula.
 *
 * @param formula   - A roll formula.
 * @param rollData  - Actor data used to determine the value of attribute references used in
 *                    the roll formula.
 * @param options   - Options passed to Roll#evaluateSync
 *                    Default `{}`
 *
 * @returns The resulting deterministic bonus, or null is one could not be
 *          calculated.
 */
export default function getDeterministicBonus(
	formula: string | number,
	rollData: Record<string, any> = {},
	options: { strict?: boolean } = {},
): number | null {
	if (formula === null || formula === undefined) return null;
	if (typeof formula === 'string' && formula.trim() === '') return 0;
	if (typeof formula === 'number' && formula === 0) return 0;

	let formulaString = formula;
	if (typeof formula === 'number') formulaString = formula.toString();

	const optionSet = {
		...options,
		strict: options.strict ?? false,
	};

	let roll: foundry.dice.Roll;

	try {
		// @ts-expect-error
		roll = new Roll(formulaString, rollData);
		if (!Roll.validate(roll.formula)) throw Error('Invalid roll formula');
	} catch (_error) {
		ui.notifications?.error(`Invalid roll formula: ${formula}`);
		return null;
	}

	const result = roll.evaluateSync({ strict: optionSet.strict });
	return result.total ?? 0;
}
