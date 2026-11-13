import { NimbleBaseRule } from './base.js';

function schema() {
	const { fields } = foundry.data;
	return {
		type: new fields.StringField({ required: true, nullable: false, initial: 'critBack' }),
	};
}

declare namespace CritBackRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/**
 * After the damage of this item is applied, a creature that lives can make one
 * attack on the owner as a crit. The GM chooses the attack.
 */
class CritBackRule extends NimbleBaseRule<CritBackRule.Schema> {
	static override worksOnEffects = false;

	static override group = 'triggers';
	static override description = 'NIMBLE.rules.critBack.description';
	static override icon = 'fa-solid fa-reply';

	static override defineSchema(): CritBackRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}
}

export { CritBackRule };
