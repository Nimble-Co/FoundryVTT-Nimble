import { NimbleBaseRule } from './base.js';

function schema() {
	const { fields } = foundry.data;

	return {
		reach: new fields.NumberField({
			required: true,
			nullable: false,
			integer: true,
			min: 0,
			initial: 4,
			label: 'NIMBLE.rules.halfDamageOnKill.reach.label',
			hint: 'NIMBLE.rules.halfDamageOnKill.reach.hint',
		}),
		type: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'halfDamageOnKill',
		}),
	};
}

declare namespace HalfDamageOnKillRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/**
 * When this attack drops a creature to 0 HP, the applier may deal half the
 * rolled damage, rounded down, to another creature within reach.
 */
class HalfDamageOnKillRule extends NimbleBaseRule<HalfDamageOnKillRule.Schema> {
	static override group = 'triggers';
	static override description = 'NIMBLE.rules.halfDamageOnKill.description';
	static override icon = 'fa-solid fa-burst';

	declare reach: number;

	static override defineSchema(): HalfDamageOnKillRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(new Map([['reach', 'number']]));
	}

	/** Spaces from the creature that died. Null when this rule does not apply. */
	halfOnKill(): number | null {
		if (!this.isOnActor || !this.appliesTo()) return null;
		return Math.max(0, Math.trunc(Number(this.reach) || 0));
	}
}

export { HalfDamageOnKillRule };
