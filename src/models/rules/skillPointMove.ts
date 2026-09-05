import { NimbleBaseRule } from './base.js';

function schema() {
	const { fields } = foundry.data;

	return {
		points: new fields.NumberField({
			required: true,
			nullable: false,
			initial: 1,
			integer: true,
			min: 1,
			label: 'NIMBLE.rules.skillPointMove.points.label',
			hint: 'NIMBLE.rules.skillPointMove.points.hint',
		}),
		trigger: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'safeRest',
			label: 'NIMBLE.rules.skillPointMove.trigger.label',
			hint: 'NIMBLE.rules.skillPointMove.trigger.hint',
			// Resolved lazily: CONFIG.NIMBLE is not populated at module-eval time, and the
			// object form makes the select render the label rather than the raw key.
			choices: () => CONFIG.NIMBLE.restTypes,
		}),
		type: new fields.StringField({ required: true, nullable: false, initial: 'skillPointMove' }),
	};
}

declare namespace SkillPointMoveRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/**
 * Lets the character move skill points between skills on a rest.
 *
 * A move is net zero: one skill loses what another gains. It is not recorded in
 * `levelUpHistory`, because that record exists so level down can subtract what a
 * level added, and a move belongs to no level. The skill totals are the truth.
 *
 * The limits the books state are the ones enforced: a skill may not go negative,
 * and it may not exceed the +12 cap.
 */
class SkillPointMoveRule extends NimbleBaseRule<SkillPointMoveRule.Schema> {
	static override group = 'grants';
	static override description = 'NIMBLE.rules.skillPointMove.description';

	declare points: number;

	// `trigger` is inferred from the schema's `choices` (the rest-type keys); re-declaring
	// it as the wider `string` would clash with that type.

	static override defineSchema(): SkillPointMoveRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['points', 'number'],
				['trigger', 'string'],
			]),
		);
	}

	/** Whether this rule offers a skill point move on the given event. */
	offersMoveOn(trigger: string): boolean {
		if (this.trigger !== trigger) return false;
		if (!Number.isFinite(this.points) || this.points < 1) return false;
		return this.appliesTo();
	}
}

export { SkillPointMoveRule };
