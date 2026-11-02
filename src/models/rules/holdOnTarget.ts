import { NimbleBaseRule } from './base.js';

function schema() {
	const { fields } = foundry.data;
	return {
		type: new fields.StringField({ required: true, nullable: false, initial: 'holdOnTarget' }),
		heldKind: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'mustAttackOther',
			choices: ['mustAttackOther', 'vulnerableOnce'],
		}),
		damageType: new fields.StringField({ required: true, nullable: false, initial: '' }),
	};
}

declare namespace HoldOnTargetRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/** A use of this item that does not miss puts a Held Change on each target. */
class HoldOnTargetRule extends NimbleBaseRule<HoldOnTargetRule.Schema> {
	static override group = 'triggers';
	static override description = 'NIMBLE.rules.holdOnTarget.description';

	static override defineSchema(): HoldOnTargetRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}
}

export { HoldOnTargetRule };
