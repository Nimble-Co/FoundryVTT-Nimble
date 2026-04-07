/**
 * Options for constructing a d20 die term.
 */
export type d20TermOptions = {
	/** The actor making the roll (currently unused but reserved for future features). */
	actor: Actor;
	/** Minimum value for the d20 roll (e.g., 10 for reliable talent). */
	minRoll: number;
	/** Roll mode: positive for advantage, negative for disadvantage, 0 for normal. */
	rollMode: number;
};

/**
 * Constructs the d20 portion of a roll formula with advantage/disadvantage and minimum roll support.
 *
 * This function builds a d20 term string based on:
 * - **rollMode**: Determines advantage/disadvantage
 *   - Positive: Roll multiple d20s and keep highest (e.g., `2d20khn` for advantage)
 *   - Negative: Roll multiple d20s and keep lowest (e.g., `2d20kln` for disadvantage)
 *   - Zero: Roll a single d20
 * - **minRoll**: Adds a minimum modifier (e.g., `1d20min10` for reliable talent)
 *
 * @param options - Configuration options for the d20 term.
 * @param options.actor - The actor making the roll (reserved for future use).
 * @param options.minRoll - Minimum d20 value. Values > 1 add a `min` modifier.
 * @param options.rollMode - Advantage level (positive), disadvantage level (negative), or normal (0).
 * @returns A d20 term string (e.g., "1d20", "2d20khn", "2d20min10kln").
 *
 * @example
 * ```typescript
 * constructD20Term({ actor, minRoll: 1, rollMode: 0 });  // "1d20"
 * constructD20Term({ actor, minRoll: 1, rollMode: 1 });  // "2d20khn" (advantage)
 * constructD20Term({ actor, minRoll: 1, rollMode: -1 }); // "2d20kln" (disadvantage)
 * constructD20Term({ actor, minRoll: 10, rollMode: 0 }); // "1d20min10" (reliable talent)
 * constructD20Term({ actor, minRoll: 10, rollMode: 1 }); // "2d20min10khn"
 * ```
 */
export default function constructD20Term({ actor: _actor, minRoll, rollMode }: d20TermOptions) {
	let d20Term = '1d20';

	if (rollMode > 0) d20Term = `${rollMode + 1}d20`;
	else if (rollMode < 0) d20Term = `${Math.abs(rollMode) + 1}d20`;

	if (minRoll > 1) d20Term += `min${minRoll}`;

	// Use Nimble's leftmost-on-tie keep modifiers (registered at init).
	if (rollMode > 0) d20Term += 'khn';
	else if (rollMode < 0) d20Term += 'kln';

	return d20Term;
}
