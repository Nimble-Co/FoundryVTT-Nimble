/** The first dice term of a formula: how many dice, their faces, and where its count is written. */
export interface FirstDice {
	count: number;
	faces: number;
	/** The count is the text from `countStart` up to `dieIndex`, the `d`. Empty for "d6". */
	countStart: number;
	dieIndex: number;
}

/** Where the count of the dice before the `d` at `dieIndex` starts: digits or a balanced parenthesis. */
function countStartOf(formula: string, dieIndex: number): number {
	let start = dieIndex;
	if (formula[start - 1] === ')') {
		let depth = 0;
		for (let index = start - 1; index >= 0; index -= 1) {
			if (formula[index] === ')') depth += 1;
			if (formula[index] === '(') depth -= 1;
			if (depth === 0) return index;
		}
		return dieIndex;
	}
	while (start > 0 && /\d/.test(formula[start - 1] ?? '')) start -= 1;
	return start;
}

function countOf(text: string, rollData: Record<string, unknown>): number {
	if (text === '') return 1;
	if (/^\d+$/.test(text)) return Number(text);
	try {
		const value = Roll.safeEval(Roll.replaceFormulaData(text, rollData, { missing: '0' }));
		return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
	} catch {
		return 0;
	}
}

/** The first dice of a formula, with the count worked out from the roll data, or null. */
export function firstDiceOf(formula: string, rollData: Record<string, unknown>): FirstDice | null {
	const pattern = /d(\d+)/gi;
	for (const match of formula.matchAll(pattern)) {
		const dieIndex = match.index ?? 0;
		const before = formula[dieIndex - 1] ?? '';
		if (/[a-z_@.]/i.test(before)) continue;
		const countStart = countStartOf(formula, dieIndex);
		return {
			count: countOf(formula.slice(countStart, dieIndex), rollData),
			faces: Number(match[1]),
			countStart,
			dieIndex,
		};
	}
	return null;
}
