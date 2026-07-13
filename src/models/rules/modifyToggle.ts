import { NimbleBaseRule } from './base.js';
import { TURN_OFF_CHOICES, type TurnOffEvent } from './toggleEffect.js';

function schema() {
	const { fields } = foundry.data;

	return {
		// Matches the target toggleEffect rule's `identifier` field, falling
		// back to the rule's `id` when no identifier is set. Lets one item's
		// rule modify a toggle defined on another (or the same) item, e.g. a
		// high-level feature that removes a turn-off trigger from an earlier
		// feature's toggle.
		toggleIdentifier: new fields.StringField({
			required: true,
			nullable: false,
			initial: '',
			label: 'NIMBLE.rules.modifyToggle.toggleIdentifier.label',
			hint: 'NIMBLE.rules.modifyToggle.toggleIdentifier.hint',
		}),
		// Turn-off events the target toggle should ignore. Shares the
		// toggleEffect turn-off vocabulary so the two lists never drift.
		suppressTurnOff: new fields.ArrayField(
			new fields.StringField({
				required: true,
				nullable: false,
				initial: 'onActorKilled',
				choices: TURN_OFF_CHOICES as unknown as string[],
			}),
			{
				required: true,
				nullable: false,
				label: 'NIMBLE.rules.modifyToggle.suppressTurnOff.label',
				hint: 'NIMBLE.rules.modifyToggle.suppressTurnOff.hint',
			},
		),
		type: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'modifyToggle',
		}),
	};
}

declare namespace ModifyToggleRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/**
 * Passive data rule that modifies the behavior of a sibling toggleEffect
 * rule identified by `toggleIdentifier`. It implements no lifecycle hooks
 * of its own; ToggleEffectRule consults matching modifyToggle rules on the
 * owning actor when deciding whether an automatic turn-off trigger fires.
 */
class ModifyToggleRule extends NimbleBaseRule<ModifyToggleRule.Schema> {
	static override group = 'triggers';
	static override description = 'NIMBLE.rules.modifyToggle.description';

	declare toggleIdentifier: string;

	declare suppressTurnOff: TurnOffEvent[];

	static override defineSchema(): ModifyToggleRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['toggleIdentifier', 'string'],
				[
					'suppressTurnOff',
					TURN_OFF_CHOICES.map((t) => `'${t}'`).join(
						' <span class="nimble-type-summary__operator">|</span> ',
					),
				],
			]),
		);
	}
}

export { ModifyToggleRule };
