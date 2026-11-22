import termDisplayExpression from './termDisplayExpression.js';

export default function prepareRollTooltipFormula(roll) {
	const terms = roll.terms.reduce((acc, term) => {
		let newTerm = `<span class="nimble-roll-formula__term">${termDisplayExpression(term)}`;

		if (term.flavor) newTerm += ` [${term.flavor}]`;

		newTerm += '</span>';

		return acc + newTerm;
	}, '');

	// const terms = roll.originalFormula ?? roll.formula;

	return `<div class="nimble-roll-formula nimble-roll-formula--tooltip">${terms}</div>`;
}
