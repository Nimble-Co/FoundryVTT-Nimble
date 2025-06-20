import type { NimbleBaseActor } from '../documents/actor/base.svelte.js';
import type { NimbleBaseItem } from '../documents/item/base.svelte.js';

import constructD20Term from './constructD20Term.js';
import simplifyOperatorTerms from './simplifyOperatorTerms.js';

export type D20RollOptions = {
	actor: NimbleBaseActor;
	item?: NimbleBaseItem | undefined;
	minRoll: number;
	modifiers: { label: string; value: number }[];
	rollMode: number;
};

/**
 * A helper function to construct a roll formula from an array of component values.
 *
 * Values which are undefined, null, or 0 are not included in the resulting formula, and some
 * arithmetic simplification is performed on the resulting formula for presentational purposes.
 *
 * @returns {string} A valid roll formula that can be passed to Roll.
 */
export default function constructD20RollFormula({
	actor,
	item,
	minRoll,
	modifiers,
	rollMode,
}: D20RollOptions) {
	const rollData: Record<string, any> = actor.getRollData(item);

	const parts = [
		constructD20Term({ actor, minRoll, rollMode }),
		...(modifiers ?? []).map(({ label, value }) => {
			if (!value || value === 0) return null;

			let modifier;

			try {
				modifier = new Roll(value.toString(), rollData);
			} catch (err) {
				return null;
			}

			modifier.terms.forEach((m) => {
				if (m.constructor.name !== 'OperatorTerm') m.options.flavor ??= label;
			});

			return modifier.formula;
		}),
	];

	const formula = parts.filter((part) => part && part !== '0').join(' + ');

	const { terms } = new Roll(formula, rollData);
	const simplifiedTerms = simplifyOperatorTerms(terms);

	return { rollFormula: Roll.getFormula(simplifiedTerms) };
}
