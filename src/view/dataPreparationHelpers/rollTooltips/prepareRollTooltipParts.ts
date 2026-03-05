import prepareRollTooltipDiceResults from './prepareRollTooltipDiceResults.js';

/**
 * Represents a single die result from Foundry's dice system.
 */
interface DieResult {
	result: number;
	active: boolean;
	discarded?: boolean;
	exploded?: boolean;
}

/**
 * Represents a dice term from a roll (e.g., the "1d6" part of "1d6+2").
 */
interface DicePart {
	expression: string;
	flavor?: string;
	options?: { flavor?: string };
	faces: number;
	/** Original number of dice before explosion added more */
	number?: number;
	total: number;
	results: DieResult[];
}

/**
 * Represents an evaluated roll with dice terms.
 */
interface RollWithDice {
	dice: DicePart[];
}

/**
 * Separates Primary Die results into initial roll and explosion rolls.
 * Uses the die's original `number` property to determine the split point.
 * Initial rolls are the first N results where N is the original number of dice.
 * Explosion rolls are any results beyond that (added by the explosion mechanic).
 *
 * This correctly handles advantage/disadvantage where multiple dice are rolled
 * but only one is kept - all original dice belong in initialRolls regardless
 * of whether they were discarded.
 *
 * @param results - Array of dice results from the primary die
 * @param originalNumber - The original number of dice rolled (before explosions)
 * @returns Object containing initialRolls and explosionRolls arrays
 */
function separatePrimaryDieResults(
	results: DieResult[],
	originalNumber: number,
): { initialRolls: DieResult[]; explosionRolls: DieResult[] } {
	// Split at the original number of dice - anything beyond that is from explosions
	const initialRolls = results.slice(0, originalNumber);
	const explosionRolls = results.slice(originalNumber);

	return { initialRolls, explosionRolls };
}

/**
 * Creates a dice section HTML block.
 * @param expression - The dice expression (e.g., "1d6", "2d4")
 * @param flavor - The section label (e.g., "Primary Die", "Damage Dice")
 * @param total - The sum of active dice results
 * @param faces - Number of faces on the dice
 * @param results - Array of individual dice results
 * @param showFumble - Whether to display fumble styling for rolls of 1
 * @returns HTML string for the dice section
 */
function createDiceSection(
	expression: string,
	flavor: string,
	total: number,
	faces: number,
	results: DieResult[],
	showFumble = false,
): string {
	let section = `<section class="nimble-roll-details">
          <header class="nimble-roll-details__header">
              <div class="nimble-roll-details__formula">
                  ${expression}
                  <span class="nimble-roll-details__flavor">`;

	if (flavor) section += ` [${flavor}]`;

	section += `</span></div>
              <span class="nimble-roll-details__total">${total}</span>
          </header>

      <ol class="nimble-roll-details__dice-list">`;

	section += prepareRollTooltipDiceResults({ faces, results, showFumble });
	section += '</ol></section>';

	return section;
}

/**
 * Prepares the HTML for roll tooltip dice sections.
 * Separates Primary Die from Explosion Dice and Damage Dice for clear display.
 * @param roll - The evaluated roll containing dice terms
 * @returns HTML string with all dice sections
 */
export default function prepareRollTooltipRollParts(roll: RollWithDice): string {
	return roll.dice.reduce((acc: string, part: DicePart) => {
		const isPrimaryDie = part.flavor === 'Primary Die' || part.options?.flavor === 'Primary Die';

		if (isPrimaryDie) {
			// Use the die's number property to determine original dice count
			// Falls back to 1 if not available (standard single die roll)
			const originalNumber = part.number ?? 1;
			const { initialRolls, explosionRolls } = separatePrimaryDieResults(
				part.results,
				originalNumber,
			);

			// Calculate totals for each section
			const initialTotal = initialRolls.reduce(
				(sum, r) => sum + (r.active && !r.discarded ? r.result : 0),
				0,
			);
			const explosionTotal = explosionRolls.reduce(
				(sum, r) => sum + (r.active && !r.discarded ? r.result : 0),
				0,
			);

			// Primary Die section (showFumble: true - only initial roll can be a miss)
			let output = createDiceSection(
				part.expression,
				'Primary Die',
				initialTotal,
				part.faces,
				initialRolls,
				true,
			);

			// Explosion Dice section (only if there are explosion rolls)
			if (explosionRolls.length > 0) {
				output += createDiceSection(
					`${explosionRolls.length}d${part.faces}`,
					'Explosion Dice',
					explosionTotal,
					part.faces,
					explosionRolls,
				);
			}

			return acc + output;
		}

		// Non-Primary Die terms (Damage Dice or other)
		const flavor = part.flavor || 'Damage Dice';
		return acc + createDiceSection(part.expression, flavor, part.total, part.faces, part.results);
	}, '');
}
