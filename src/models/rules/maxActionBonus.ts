import { MAX_ACTION_BONUS_PATH } from '#utils/actor/actorHealthState.js';
import { withWidget } from './_widgetOption.js';
import { NimbleBaseRule } from './base.js';

function schema() {
	const { fields } = foundry.data;

	return {
		value: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: '1',
				label: 'NIMBLE.rules.maxActionBonus.value.label',
				hint: 'NIMBLE.rules.maxActionBonus.value.hint',
				widget: 'formula',
			}),
		),
		type: new fields.StringField({ required: true, nullable: false, initial: 'maxActionBonus' }),
	};
}

declare namespace MaxActionBonusRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/**
 * Adds to the creature's max actions while the rule's predicate holds ("+1 max action"). The
 * combat system adds it to the combatant's action max, so a turn starts with it.
 */
class MaxActionBonusRule extends NimbleBaseRule<MaxActionBonusRule.Schema> {
	static override group = 'bonuses';
	static override description = 'NIMBLE.rules.maxActionBonus.description';
	static override icon = 'fa-solid fa-bolt';

	declare value: string;

	static override defineSchema(): MaxActionBonusRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(new Map([['value', 'string']]));
	}

	override afterPrepareData(): void {
		if (!this.isOnActor || !this.test()) return;
		const { actor } = this;
		const bonus = Math.trunc(Number(this.resolveFormula(this.value)) || 0);
		const current = Number(foundry.utils.getProperty(actor.system, MAX_ACTION_BONUS_PATH)) || 0;
		foundry.utils.setProperty(actor.system, MAX_ACTION_BONUS_PATH, current + bonus);
	}
}

export { MaxActionBonusRule };
