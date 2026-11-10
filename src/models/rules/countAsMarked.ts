import { NimbleBaseRule } from './base.js';

const WORDS = 'NIMBLE.rules.countAsMarked';

export const COUNT_AS_MARKED_DELIVERIES = ['melee', 'ranged', 'any'] as const;

export type CountAsMarkedDelivery = (typeof COUNT_AS_MARKED_DELIVERIES)[number];

function schema() {
	const { fields } = foundry.data;
	return {
		type: new fields.StringField({ required: true, nullable: false, initial: 'countAsMarked' }),
		flagKey: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'quarry',
			label: `${WORDS}.flagKey.label`,
			hint: `${WORDS}.flagKey.hint`,
		}),
		delivery: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'melee',
			choices: Object.fromEntries(
				COUNT_AS_MARKED_DELIVERIES.map((each) => [each, `${WORDS}.delivery.choices.${each}`]),
			),
			label: `${WORDS}.delivery.label`,
			hint: `${WORDS}.delivery.hint`,
		}),
	};
}

declare namespace CountAsMarkedRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/** Every creature the owner attacks counts as marked with `flagKey`, for attacks of `delivery`. */
class CountAsMarkedRule extends NimbleBaseRule<CountAsMarkedRule.Schema> {
	declare flagKey: string;
	declare delivery: CountAsMarkedDelivery;

	static override group = 'conditions';
	static override description = `${WORDS}.description`;
	static override icon = 'fa-solid fa-crosshairs';

	static override defineSchema(): CountAsMarkedRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	/** The tag it adds to the target of an attack of `delivery`, or null. */
	markedTagFor(delivery: 'melee' | 'ranged' | null | undefined): string | null {
		const key = this.flagKey.trim();
		if (!key || !delivery || !this.test()) return null;
		if (this.delivery !== 'any' && this.delivery !== delivery) return null;
		return `target:${key}`;
	}
}

export { CountAsMarkedRule };
