import type { CategorizedDie, DieResultDump, ParsedDie } from './DiceTestbench.types.js';

/**
 * Categorize a single primary-die result by its position in the results
 * array (whether it's a base die or an explosion reroll) and its provenance
 * tag (set by manual vicious explosion).
 *
 * `baseCount` is the term's configured `number` — the count of dice that
 * Foundry rolled as the original pool. Anything beyond that index is an
 * explosion reroll.
 */
export function categorizeDie(
	r: DieResultDump,
	index: number,
	baseCount: number,
): CategorizedDie['category'] {
	if (r.discarded) return 'dropped';
	if (r.provenance === 'viciousChain') return 'viciousChain';
	if (r.provenance === 'viciousBonus') return 'viciousBonus';
	if (index < baseCount) return 'kept';
	return 'critReroll';
}

/** Parse a dice formula string into individual die descriptors. */
export function parseFormulaForDice(formula: string): ParsedDie[] {
	const result: ParsedDie[] = [];
	const re = /(\d+)?d(\d+)/g;
	let match: RegExpExecArray | null;
	let termIndex = 0;
	while ((match = re.exec(formula)) !== null) {
		const count = match[1] ? parseInt(match[1], 10) : 1;
		const faces = parseInt(match[2], 10);
		for (let i = 0; i < count; i += 1) {
			result.push({ termIndex, dieIndex: i, faces });
		}
		termIndex += 1;
	}
	return result;
}
