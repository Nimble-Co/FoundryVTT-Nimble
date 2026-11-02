import { NimbleBaseRule } from './base.js';

function schema() {
	const { fields } = foundry.data;
	return {
		type: new fields.StringField({ required: true, nullable: false, initial: 'invokeChaos' }),
	};
}

declare namespace InvokeChaosRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/**
 * The spell dialog has a tick for 1 less mana. The tick or a crit rolls on the
 * Chaos Table. The system shows the text of the table, and applies no effect.
 */
class InvokeChaosRule extends NimbleBaseRule<InvokeChaosRule.Schema> {
	static override group = 'triggers';
	static override description = 'NIMBLE.rules.invokeChaos.description';

	static override defineSchema(): InvokeChaosRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	get invokesChaos(): boolean {
		return this.item.isEmbedded && this.test();
	}
}

export { InvokeChaosRule };
