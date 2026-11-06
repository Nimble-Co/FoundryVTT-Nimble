import { choiceLabels } from './_rollUseRule.js';
import { NimbleBaseRule } from './base.js';

const WHEN_CHOICES = ['hit', 'crit'] as const;
const RECIPIENT_CHOICES = ['target', 'self'] as const;

function schema() {
	const { fields } = foundry.data;
	return {
		condition: new fields.StringField({
			required: true,
			nullable: false,
			initial: '',
			label: 'NIMBLE.rules.hitCondition.condition.label',
			hint: 'NIMBLE.rules.hitCondition.condition.hint',
		}),
		when: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'hit',
			choices: choiceLabels('hitCondition', 'when', WHEN_CHOICES),
			label: 'NIMBLE.rules.hitCondition.when.label',
			hint: 'NIMBLE.rules.hitCondition.when.hint',
		}),
		recipient: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'target',
			choices: choiceLabels('hitCondition', 'recipient', RECIPIENT_CHOICES),
			label: 'NIMBLE.rules.hitCondition.recipient.label',
			hint: 'NIMBLE.rules.hitCondition.recipient.hint',
		}),
		type: new fields.StringField({ required: true, nullable: false, initial: 'hitCondition' }),
	};
}

declare namespace HitConditionRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/** When the damage of this item is applied, a creature gets a condition. */
class HitConditionRule extends NimbleBaseRule<HitConditionRule.Schema> {
	declare condition: string;
	declare when: (typeof WHEN_CHOICES)[number];
	declare recipient: (typeof RECIPIENT_CHOICES)[number];

	static override group = 'triggers';
	static override description = 'NIMBLE.rules.hitCondition.description';
	static override icon = 'fa-solid fa-link';

	static override defineSchema(): HitConditionRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['condition', 'string'],
				['when', 'string'],
				['recipient', 'string'],
			]),
		);
	}
}

export { HitConditionRule };
