import { DYING_ACTION_LIMIT_PATH, DYING_MAX_ACTIONS } from '#utils/actorHealthState.js';
import { withWidget } from './_widgetOption.js';
import { NimbleBaseRule } from './base.js';

function schema() {
	const { fields } = foundry.data;

	return {
		value: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: String(DYING_MAX_ACTIONS),
				label: 'NIMBLE.rules.dyingActionLimit.value.label',
				widget: 'formula',
			}),
		),
		type: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'dyingActionLimit',
		}),
	};
}

declare namespace DyingActionLimitRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/**
 * Raises the actor's Dying action limit while the rule's predicate holds (e.g.
 * `self:dying`). The highest applicable limit wins, so the engine baseline of
 * {@link DYING_MAX_ACTIONS} is never lowered. The combat system reads the result
 * via {@link DYING_ACTION_LIMIT_PATH} when capping actions for a Dying combatant.
 */
class DyingActionLimitRule extends NimbleBaseRule<DyingActionLimitRule.Schema> {
	static override group = 'bonuses';
	static override description = 'NIMBLE.rules.dyingActionLimit.description';

	declare value: string;

	static override defineSchema(): DyingActionLimitRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(new Map([['value', 'string']]));
	}

	override afterPrepareData(): void {
		const { item } = this;
		if (!item.isEmbedded) return;
		if (!this.test()) return;

		const { actor } = item;
		const limit = this.resolveFormula(this.value) ?? DYING_MAX_ACTIONS;
		const current =
			(foundry.utils.getProperty(actor.system, DYING_ACTION_LIMIT_PATH) as number | undefined) ??
			DYING_MAX_ACTIONS;

		// Highest limit wins so stacking features never reduce the cap.
		foundry.utils.setProperty(actor.system, DYING_ACTION_LIMIT_PATH, Math.max(current, limit));
	}
}

export { DyingActionLimitRule };
