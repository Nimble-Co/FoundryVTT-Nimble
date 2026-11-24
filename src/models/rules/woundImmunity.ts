import { NimbleBaseRule } from './base.js';

function schema() {
	const { fields } = foundry.data;
	return {
		type: new fields.StringField({ required: true, nullable: false, initial: 'woundImmunity' }),
	};
}

declare namespace WoundImmunityRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/**
 * While this rule applies, Wounds that would land on its creature do not.
 * Those Wounds still count for features that watch Wounds. Put it on an effect
 * that ends when the turn ends for immunity that lasts that long.
 */
class WoundImmunityRule extends NimbleBaseRule<WoundImmunityRule.Schema> {
	static override group = 'conditions';
	static override description = 'NIMBLE.rules.woundImmunity.description';
	static override icon = 'fa-solid fa-bandage';

	static override defineSchema(): WoundImmunityRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}
}

export { WoundImmunityRule };
