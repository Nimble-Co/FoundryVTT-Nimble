import constructD20Term from './constructD20Term.js';
import simplifyOperatorTerms from './simplifyOperatorTerms.js';

/**
 * Options for constructing a d20 roll formula.
 */
export type D20RollOptions = {
	/** The actor making the roll, used to get roll data for variable resolution. */
	actor: NimbleBaseActor;
	/** Optional item associated with the roll (e.g., a weapon or spell). */
	item?: NimbleBaseItem | undefined;
	/** Minimum value for the d20 roll (e.g., 10 for reliable talent). */
	minRoll: number;
	/** Array of modifiers to add to the roll, each with an optional label and value. */
	modifiers: { label?: string | undefined; value: number | string }[];
	/** Roll mode: positive for advantage, negative for disadvantage, 0 for normal. */
	rollMode: number;
};

/**
 * Constructs a complete d20 roll formula from component parts.
 *
 * This function builds a valid dice formula by:
 * 1. Creating the d20 term with advantage/disadvantage and minimum roll modifiers
 * 2. Adding all provided modifiers with their labels as flavor text
 * 3. Filtering out null, undefined, and zero values
 * 4. Simplifying redundant operators (e.g., "+ -" becomes "-")
 *
 * @param options - Configuration options for the roll formula.
 * @param options.actor - The actor making the roll.
 * @param options.item - Optional item for additional roll data context.
 * @param options.minRoll - Minimum d20 value (e.g., 10 for reliable talent).
 * @param options.modifiers - Array of modifiers to add to the formula.
 * @param options.rollMode - Advantage (positive), disadvantage (negative), or normal (0).
 * @returns An object containing the constructed `rollFormula` string.
 *
 * @example
 * ```typescript
 * const result = constructD20RollFormula({
 *   actor: myActor,
 *   minRoll: 1,
 *   modifiers: [{ label: "Strength", value: 3 }, { label: "Proficiency", value: 2 }],
 *   rollMode: 1  // advantage
 * });
 * // result.rollFormula might be "2d20khn + 3[Strength] + 2[Proficiency]"
 * ```
 */
export default function constructD20RollFormula({
	actor,
	item,
	minRoll,
	modifiers,
	rollMode,
}: D20RollOptions) {
	const rollData = actor.getRollData(item);

	const parts = [
		constructD20Term({ actor, minRoll, rollMode }),
		...(modifiers ?? []).map(({ label, value }) => {
			if (!value || value === 0) return null;

			try {
				const modifier = new Roll(value.toString(), rollData);

				modifier.terms.forEach((m) => {
					if (m.constructor.name !== 'OperatorTerm') m.options.flavor ??= label;
				});

				return modifier.formula;
			} catch (_err) {
				return null;
			}
		}),
	];

	const formula = parts.filter((part) => part && part !== '0').join(' + ');

	const { terms } = new Roll(formula, rollData);
	const simplifiedTerms = simplifyOperatorTerms(terms);

	return { rollFormula: Roll.getFormula(simplifiedTerms) };
}
