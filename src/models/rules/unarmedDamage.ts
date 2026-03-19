import { NimbleBaseRule } from './base.js';

function schema() {
	const { fields } = foundry.data;

	return {
		value: new fields.StringField({
			required: true,
			nullable: false,
			initial: '1d4 + @abilities.strength.mod',
		}),
		type: new fields.StringField({ required: true, nullable: false, initial: 'unarmedDamage' }),
	};
}

declare namespace UnarmedDamageRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

class UnarmedDamageRule extends NimbleBaseRule<UnarmedDamageRule.Schema> {
	declare value: string;

	static override defineSchema(): UnarmedDamageRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(new Map([['value', 'string']]));
	}

	/**
	 * Apply the unarmed damage formula to the actor
	 */
	override afterPrepareData(): void {
		const { item } = this;
		if (!item.isEmbedded) return;
		if (!this.test()) return;

		const { actor } = item;

		// Set the unarmed damage formula on the actor
		foundry.utils.setProperty(actor.system, 'unarmedDamage', this.value);
	}
}

export { UnarmedDamageRule };
