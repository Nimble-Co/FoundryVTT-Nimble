/**
 * Strips redundant operators from an array of RollTerms and performs arithmetic simplification.
 *
 * This function cleans up roll formulas for better readability by:
 * - Replacing consecutive `+ -` operators with a single `-`
 * - Replacing double `- -` operators with a single `+`
 * - Removing `+` operators that directly follow `+`, `*`, or `/`
 * - Removing trailing operator terms from the end of the formula
 *
 * A new array of RollTerm objects is returned; the original array is not modified.
 *
 * @param terms - An array of RollTerm objects that form a valid roll formula.
 * @returns A new array of RollTerm objects with simplified operators.
 *
 * @example
 * ```typescript
 * // Formula "1d20 + -3" becomes "1d20 - 3"
 * // Formula "1d20 - -3" becomes "1d20 + 3"
 * // Formula "1d20 + + 3" becomes "1d20 + 3"
 * const simplified = simplifyOperatorTerms(roll.terms);
 * const formula = Roll.getFormula(simplified);
 * ```
 */
export default function simplifyOperatorTerms(terms) {
	const Terms = foundry.dice.terms;

	return terms.reduce((acc, term, i) => {
		const prior = acc[acc.length - 1];
		const ops = new Set([prior?.operator, term.operator]);

		// If the final terms is an operator term, ignore it.
		if (i === terms.length - 1 && term.operator) return acc;

		// If one of the terms is not an operator, add the current term as is.
		if (ops.has(undefined)) acc.push(term);
		// Replace consecutive "+ -" operators with a "-" operator.
		else if (ops.has('+') && ops.has('-'))
			acc.splice(-1, 1, new Terms.OperatorTerm({ operator: '-' }));
		// Replace double "-" operators with a "+" operator.
		else if (ops.has('-') && ops.size === 1)
			acc.splice(-1, 1, new Terms.OperatorTerm({ operator: '+' }));
		// Don't include "+" operators that directly follow "+", "*", or "/".
		// Otherwise, add the term as is.
		else if (!ops.has('+')) acc.push(term);

		return acc;
	}, []);
}
