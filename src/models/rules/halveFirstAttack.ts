import { SYSTEM_ID } from '#system';
import {
	FIRST_ATTACK_HALVE_FLAG,
	HALVE_FIRST_ATTACK_PATH,
} from '#utils/damage/firstAttackHalve.js';
import { NimbleBaseRule } from './base.js';

function schema() {
	const { fields } = foundry.data;

	return {
		type: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'halveFirstAttack',
		}),
	};
}

declare namespace HalveFirstAttackRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/**
 * Halves the first attack against the owner each combat round. The damage
 * path reads {@link HALVE_FIRST_ATTACK_PATH}; the stamp is cleared when the
 * combat round changes, including a rewind.
 */
class HalveFirstAttackRule extends NimbleBaseRule<HalveFirstAttackRule.Schema> {
	static override group = 'bonuses';
	static override description = 'NIMBLE.rules.halveFirstAttack.description';
	static override icon = 'fa-solid fa-shield-halved';

	// afterPrepareData still marks the actor when rule automation is off, so
	// the round reset has to run then too. There is no button for this halve.
	static override alwaysDispatchedEvents: readonly (keyof NimbleBaseRule)[] = ['onRoundChanged'];

	static override defineSchema(): HalveFirstAttackRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override afterPrepareData(): void {
		if (!this.isOnActor) return;
		if (!this.test()) return;
		foundry.utils.setProperty(this.actor.system, HALVE_FIRST_ATTACK_PATH, true);
	}

	override async onRoundChanged(): Promise<void> {
		if (!this.isOnActor) return;
		await this.actor.unsetFlag(SYSTEM_ID, FIRST_ATTACK_HALVE_FLAG);
	}
}

export { HalveFirstAttackRule };
