import { NimbleBaseRule } from './base.js';

/** Sentinel accepted by `selectionGroups`, meaning every pool the character's class offers. */
const ALL_GROUPS = 'all';

function schema() {
	const { fields } = foundry.data;

	return {
		selectionGroups: new fields.ArrayField(
			new fields.StringField({ required: true, nullable: false, initial: '' }),
			{
				required: true,
				nullable: false,
				initial: () => [ALL_GROUPS],
				label: 'NIMBLE.rules.optionSwap.selectionGroups.label',
				hint: 'NIMBLE.rules.optionSwap.selectionGroups.hint',
			} as unknown as never,
		),
		trigger: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'safeRest',
			label: 'NIMBLE.rules.optionSwap.trigger.label',
			hint: 'NIMBLE.rules.optionSwap.trigger.hint',
			// Resolved lazily: CONFIG.NIMBLE is not populated at module-eval time, and the
			// object form makes the select render the label rather than the raw key.
			choices: () => CONFIG.NIMBLE.restTypes,
		}),
		type: new fields.StringField({ required: true, nullable: false, initial: 'optionSwap' }),
	};
}

declare namespace OptionSwapRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/**
 * Offers the character a chance to swap class options they already picked.
 *
 * This is the machinery behind the per-class features that let a character change
 * their mind — the Berserker's Wrath & Ruin, the Mage's Study!, and their siblings.
 * Every one of them requires an act in the fiction as well as the rest, and no such
 * act is detectable, so the rule gates nothing: it declares what may be swapped and
 * when the swap is offered, and the table decides whether it is earned. State the
 * required act in the rule's `label` so the player reads it at the moment of choosing.
 *
 * `selectionGroups` names the pools the swap covers. The books say "different
 * <Class> options available to you" without naming a pool, so the sentinel `all`
 * is the faithful setting; explicit group names exist for content that means less.
 */
class OptionSwapRule extends NimbleBaseRule<OptionSwapRule.Schema> {
	static override group = 'grants';
	static override description = 'NIMBLE.rules.optionSwap.description';

	declare selectionGroups: string[];

	// `trigger` is inferred from the schema's `choices` (the rest-type keys); re-declaring
	// it as the wider `string` would clash with that type.

	static override defineSchema(): OptionSwapRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['selectionGroups', 'string[]'],
				['trigger', 'string'],
			]),
		);
	}

	/** Whether this rule offers a swap on the given event. */
	offersSwapOn(trigger: string): boolean {
		if (this.trigger !== trigger) return false;
		if (this.selectionGroups.length === 0) return false;
		return this.appliesTo();
	}

	/** Whether the rule covers every pool the class offers, rather than a named few. */
	get coversAllGroups(): boolean {
		return this.selectionGroups.includes(ALL_GROUPS);
	}

	/** The named pools this rule covers, empty when it covers all of them. */
	get namedGroups(): string[] {
		if (this.coversAllGroups) return [];
		return this.selectionGroups.map((group) => group.trim()).filter((group) => group.length > 0);
	}
}

export { ALL_GROUPS, OptionSwapRule };
