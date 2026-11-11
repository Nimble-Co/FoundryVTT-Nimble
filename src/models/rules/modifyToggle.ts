import { LASTS_UNTIL_EVENTS, type LastsUntilEvent } from '../activeEffect/nimbleEffectChoices.js';
import { choiceLabels } from './_rollUseRule.js';
import { NimbleBaseRule } from './base.js';
import { TURN_ON_CHOICES, type TurnOnEvent } from './toggleEffect.js';

function schema() {
	const { fields } = foundry.data;

	return {
		// Matches the target toggleEffect rule's `identifier` field, falling
		// back to the rule's `id` when no identifier is set. Lets one item's
		// rule modify a toggle defined on another (or the same) item, e.g. a
		// high-level feature that drops a moment from an earlier feature's
		// toggle.
		toggleIdentifier: new fields.StringField({
			required: true,
			nullable: false,
			initial: '',
			label: 'NIMBLE.rules.modifyToggle.toggleIdentifier.label',
			hint: 'NIMBLE.rules.modifyToggle.toggleIdentifier.hint',
		}),
		// Lasts Until events taken out of the toggle's effect when it is made.
		dropMoments: new fields.ArrayField(
			new fields.StringField({
				required: true,
				nullable: false,
				initial: 'zeroHp',
				choices: choiceLabels('modifyToggle', 'dropMoments', LASTS_UNTIL_EVENTS),
			}),
			{
				required: true,
				nullable: false,
				label: 'NIMBLE.rules.modifyToggle.dropMoments.label',
				hint: 'NIMBLE.rules.modifyToggle.dropMoments.hint',
			},
		),
		// Events on which the target toggle switches ON automatically. This
		// rule's predicate gates the turn-on, so the granting feature carries
		// its own condition.
		turnOn: new fields.ArrayField(
			new fields.StringField({
				required: true,
				nullable: false,
				initial: 'onTurnStart',
				choices: choiceLabels('modifyToggle', 'turnOn', TURN_ON_CHOICES),
			}),
			{
				required: true,
				nullable: false,
				initial: [],
				label: 'NIMBLE.rules.modifyToggle.turnOn.label',
				hint: 'NIMBLE.rules.modifyToggle.turnOn.hint',
			} as unknown as never,
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
 * Passive data rule that modifies a sibling toggleEffect rule identified by
 * `toggleIdentifier`. It implements no lifecycle hooks of its own: the toggle
 * reads matching modifyToggle rules on the owning actor when it makes its
 * effect and when an event can turn it on.
 */
class ModifyToggleRule extends NimbleBaseRule<ModifyToggleRule.Schema> {
	static override worksOnEffects = false;

	static override group = 'triggers';
	static override description = 'NIMBLE.rules.modifyToggle.description';

	declare toggleIdentifier: string;

	declare dropMoments: LastsUntilEvent[];

	declare turnOn: TurnOnEvent[];

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
					'dropMoments',
					LASTS_UNTIL_EVENTS.map((t) => `'${t}'`).join(
						' <span class="nimble-type-summary__operator">|</span> ',
					),
				],
				[
					'turnOn',
					TURN_ON_CHOICES.map((t) => `'${t}'`).join(
						' <span class="nimble-type-summary__operator">|</span> ',
					),
				],
			]),
		);
	}
}

export { ModifyToggleRule };
