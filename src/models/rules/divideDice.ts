import { ruleLabel } from '../../utils/actor/actorRules.js';
import { isMadeThrough } from '../../utils/damage/attackOrigin.js';
import { attackOriginField } from './_attackOriginField.js';
import { NimbleBaseRule } from './base.js';

function schema() {
	const { fields } = foundry.data;

	return {
		attackOrigin: attackOriginField(),
		type: new fields.StringField({ required: true, nullable: false, initial: 'divideDice' }),
	};
}

declare namespace DivideDiceRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/**
 * The player divides the dice of an attack made through one item among its targets, in the roll
 * window, before the roll. One roll: each target takes its dice; the first takes the flat damage.
 */
class DivideDiceRule extends NimbleBaseRule<DivideDiceRule.Schema> {
	static override group = 'bonuses';
	static override description = 'NIMBLE.rules.divideDice.description';
	static override icon = 'fa-solid fa-dice';

	declare attackOrigin: string;

	static override defineSchema(): DivideDiceRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(new Map([['attackOrigin', 'string']]));
	}

	/** What divides the dice of an attack made through the item with this identifier, or null. */
	dividesDiceFor(origin: string | null | undefined): { source: string } | null {
		if (!this.isOnActor || !this.test()) return null;
		if (!this.attackOrigin?.trim() || !origin || !isMadeThrough(this.attackOrigin, origin)) {
			return null;
		}
		return { source: ruleLabel(this) };
	}
}

export { DivideDiceRule };
