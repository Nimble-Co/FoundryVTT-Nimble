import { displayFormula } from '#utils/rolls/displayFormula.ts';

interface TermView {
	expression?: string;
	denomination?: string;
	number?: unknown;
	faces?: unknown;
	modifiers?: string[];
	_evaluated?: boolean;
}

/**
 * A roll term as a player reads it: a rolled die with a worked-out count
 * shows that count, and other terms show their arithmetic worked out.
 */
export default function termDisplayExpression(term: TermView): string {
	const count = Number(term.number);
	if (term.denomination === 'd' && Number.isFinite(count) && typeof term.faces === 'number') {
		return `${count}d${term.faces}${(term.modifiers ?? []).join('')}`;
	}
	const expression = String(term.expression ?? '');
	// An operator or a lone number reads as it is.
	if (/^[\s+\-*/\d.]*$/.test(expression)) return expression;
	return displayFormula(expression) || expression;
}
