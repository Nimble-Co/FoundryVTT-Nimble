import { displayFormula } from '#utils/rolls/displayFormula.ts';
import termDisplayExpression from './termDisplayExpression.js';

interface FormulaTerm {
	expression?: string;
	flavor?: string;
	operator?: string;
	faces?: unknown;
	dice?: readonly unknown[];
}

function isAddition(term: FormulaTerm): boolean {
	return term.operator === '+' || term.operator === '-';
}

function hasDice(term: FormulaTerm): boolean {
	return term.faces !== undefined || (term.dice?.length ?? 0) > 0;
}

function termSpan(text: string, flavor: string | undefined): string {
	return `<span class="nimble-roll-formula__term">${text}${flavor ? ` [${flavor}]` : ''}</span>`;
}

/**
 * The formula row of a roll tooltip. A run of terms with no dice between a `+` and a `-`
 * shows as its worked-out number, so `(2 + floor(1 / 5)) * 2` reads as 4.
 */
export default function prepareRollTooltipFormula(roll: { terms: FormulaTerm[] }): string {
	const runs: FormulaTerm[][] = [[]];
	for (const term of roll.terms) {
		if (isAddition(term)) runs.push([term], []);
		else runs.at(-1)?.push(term);
	}

	const terms = runs
		.filter((run) => run.length > 0)
		.map((run) => {
			const [first] = run;
			if (run.length === 1 && first) return termSpan(termDisplayExpression(first), first.flavor);
			if (run.some(hasDice)) {
				return run.map((term) => termSpan(termDisplayExpression(term), term.flavor)).join('');
			}
			const expression = run.map((term) => term.expression ?? '').join('');
			const flavor = run.find((term) => term.flavor)?.flavor;
			return termSpan(displayFormula(expression) || expression, flavor);
		})
		.join('');

	return `<div class="nimble-roll-formula nimble-roll-formula--tooltip">${terms}</div>`;
}
