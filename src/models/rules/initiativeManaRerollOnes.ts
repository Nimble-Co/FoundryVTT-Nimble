import { NimbleBaseRule } from './base.js';

function schema() {
	const { fields } = foundry.data;
	return {
		type: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'initiativeManaRerollOnes',
		}),
	};
}

declare namespace InitiativeManaRerollOnesRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/** Each 1 on a die of an Initiative Mana rule rolls again one time. */
class InitiativeManaRerollOnesRule extends NimbleBaseRule<InitiativeManaRerollOnesRule.Schema> {
	static override group = 'resource';
	static override description = 'NIMBLE.rules.initiativeManaRerollOnes.description';

	static override defineSchema(): InitiativeManaRerollOnesRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	/** The feature name for the tag. Null when its condition does not hold. */
	get rerollFeature(): string | null {
		if (!this.item.isEmbedded || !this.test()) return null;
		return this.label || this.item.name || '';
	}
}

export { InitiativeManaRerollOnesRule };
