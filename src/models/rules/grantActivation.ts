import { NimbleBaseRule } from './base.js';

/**
 * The kinds of activation a recipient can be offered. A closed set so the
 * chat card knows how to build the recipient's item list.
 */
const GRANTED_ACTIVATION_TYPES = ['weaponAttack'] as const;

type GrantedActivationType = (typeof GRANTED_ACTIVATION_TYPES)[number];

function schema() {
	const { fields } = foundry.data;

	return {
		activationType: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'weaponAttack',
			label: 'NIMBLE.rules.grantActivation.activationType.label',
			hint: 'NIMBLE.rules.grantActivation.activationType.hint',
			choices: [...GRANTED_ACTIVATION_TYPES],
		}),
		type: new fields.StringField({ required: true, nullable: false, initial: 'grantActivation' }),
	};
}

declare namespace GrantActivationRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/**
 * Offers the user's current targets an immediate activation (e.g. a weapon
 * attack) when the owning item is used. Carries no lifecycle hooks — the
 * item-use hook (`src/hooks/actionEconomySystem.ts`) collects matching rules
 * and stamps granted-activation offers onto the item's chat card, where the
 * recipient's owner (or a GM) can accept them.
 *
 * The offer only opens the recipient's normal activation flow; any action
 * cost for the recipient is governed by the granting feature's other rules
 * (e.g. an action-cost or action-adjustment rule), not by the offer itself.
 */
class GrantActivationRule extends NimbleBaseRule<GrantActivationRule.Schema> {
	static override group = 'resource';
	static override description = 'NIMBLE.rules.grantActivation.description';

	declare activationType: GrantedActivationType;

	static override defineSchema(): GrantActivationRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(new Map([['activationType', '"weaponAttack"']]));
	}
}

export { GrantActivationRule, type GrantedActivationType };
