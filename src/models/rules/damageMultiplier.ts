import { NimbleBaseRule } from './base.js';

function schema() {
	const { fields } = foundry.data;
	return {
		type: new fields.StringField({ required: true, nullable: false, initial: 'damageMultiplier' }),
		multiplier: new fields.NumberField({
			required: true,
			nullable: false,
			initial: 2,
			integer: true,
			min: 2,
			label: 'NIMBLE.rules.damageMultiplier.multiplier.label',
			hint: 'NIMBLE.rules.damageMultiplier.multiplier.hint',
		}),
	};
}

declare namespace DamageMultiplierRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/**
 * A tick in the roll window of this item that multiplies its damage. The label
 * says when it applies. The player decides; the system checks nothing.
 */
class DamageMultiplierRule extends NimbleBaseRule<DamageMultiplierRule.Schema> {
	static override worksOnEffects = false;

	static override group = 'triggers';
	static override description = 'NIMBLE.rules.damageMultiplier.description';
	static override icon = 'fa-solid fa-xmark';

	static override defineSchema(): DamageMultiplierRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}
}

export { DamageMultiplierRule };
