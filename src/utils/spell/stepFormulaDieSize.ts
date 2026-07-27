/** Standard die progression used when a die size is stepped up or down. */
const DIE_SIZE_CHAIN = [4, 6, 8, 10, 12, 20];

/**
 * Matches dice terms such as `d6`, `1d6` or `2d10`. The lookbehind keeps it from
 * matching inside an identifier or a roll-data path such as `@attributes.hitDice.d8.current`.
 */
const DICE_TERM_PATTERN = /(?<![\w.])(\d*)d(\d+)/g;

/**
 * Steps every die term in a roll formula up the standard die chain
 * (d4 → d6 → d8 → d10 → d12 → d20), rewriting the existing die rather than
 * appending a new term.
 *
 * Dice whose size is not part of the chain (d3, d100, …) are left untouched, as
 * are dice that already meet or exceed the cap.
 *
 * @param formula - The roll formula to rewrite, e.g. `1d6+@abilities.wil.mod`.
 * @param steps - How many positions to move up the chain. Values below 1 are a no-op.
 * @param maxFaces - Largest allowed die size, or `null` for the top of the chain.
 */
export function stepFormulaDieSize(
	formula: string,
	steps: number,
	maxFaces: number | null,
): string {
	if (!formula || steps < 1) return formula;

	const cappedIndex = maxFaces === null ? -1 : DIE_SIZE_CHAIN.indexOf(maxFaces);
	const capIndex = cappedIndex === -1 ? DIE_SIZE_CHAIN.length - 1 : cappedIndex;

	return formula.replace(DICE_TERM_PATTERN, (term, count: string, faces: string) => {
		const currentIndex = DIE_SIZE_CHAIN.indexOf(Number(faces));
		if (currentIndex === -1 || currentIndex >= capIndex) return term;

		return `${count}d${DIE_SIZE_CHAIN[Math.min(currentIndex + steps, capIndex)]}`;
	});
}
