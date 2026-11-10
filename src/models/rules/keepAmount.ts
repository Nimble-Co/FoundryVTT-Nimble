import type { UseCost } from '#types/useCost.d.ts';
import { ruleKey } from '../../utils/actor/actorRules.js';
import { canPayUseCost, chargeOnlyCost } from '../../utils/cost/useCost.js';
import type {
	RerollTrigger,
	RollEffect,
} from '../../utils/incomingReactions/incomingReactionEntry.js';
import type { RollUseContext } from './_rollUseRule.js';
import { NimbleBaseRule } from './base.js';

function schema() {
	const { fields } = foundry.data;
	return {
		type: new fields.StringField({ required: true, nullable: false, initial: 'keepAmount' }),
	};
}

declare namespace KeepAmountRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/**
 * A row on a card with a hit, 1/turn: the owner's next attack this turn uses
 * the damage total of that card, in place of a roll.
 */
class KeepAmountRule extends NimbleBaseRule<KeepAmountRule.Schema> {
	static override group = 'triggers';
	static override description = 'NIMBLE.rules.keepAmount.description';
	static override icon = 'fa-solid fa-rotate';

	static override defineSchema(): KeepAmountRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	offersUseOn(context: RollUseContext): boolean {
		if (!this.isOnActor || !this.test()) return false;
		if (!game.combat?.started) return false;
		if (context.side !== 'roller' || context.roll.kind !== 'attack') return false;
		return canPayUseCost(this.actor as Actor | null, this.rollUseCost);
	}

	get rollEffect(): RollEffect {
		return 'keepAmount';
	}

	get outcome(): RerollTrigger {
		return 'hit';
	}

	get oncePerRoll(): boolean {
		return true;
	}

	get rollUseCost(): UseCost {
		return { ...chargeOnlyCost(''), turnUseKey: ruleKey(this) };
	}
}

export { KeepAmountRule };
