import { ORIGIN_ATTACKERS } from '../../utils/damage/attackOrigin.js';
import { withWidget } from './_widgetOption.js';

/** The options of the "Only attacks made through" field: an item identifier. Blank is every attack. */
export function attackOriginFieldOptions() {
	return {
		required: true,
		nullable: false,
		initial: '',
		label: 'NIMBLE.rules.attackOrigin.label',
		hint: 'NIMBLE.rules.attackOrigin.hint',
	} as const;
}

/** The "Only attacks made through" field: an item identifier. Blank is every attack. */
export function attackOriginField() {
	return new foundry.data.fields.StringField(attackOriginFieldOptions());
}

/**
 * The "Attacks by" field of a rule with an "Only attacks made through" scope: the owner's
 * attacks only, or also the attacks other creatures make through that item. `showWhen`
 * is the visibility of the scope field.
 */
export function originAttackerField(showWhen?: (data: Record<string, unknown>) => boolean) {
	return new foundry.data.fields.StringField(
		withWidget({
			required: true,
			nullable: false,
			initial: 'self',
			label: 'NIMBLE.rules.originAttacker.label',
			hint: 'NIMBLE.rules.originAttacker.hint',
			choices: () =>
				Object.fromEntries(
					ORIGIN_ATTACKERS.map((value) => [value, `NIMBLE.rules.originAttacker.choices.${value}`]),
				),
			...(showWhen ? { showWhen } : {}),
		}),
	);
}
