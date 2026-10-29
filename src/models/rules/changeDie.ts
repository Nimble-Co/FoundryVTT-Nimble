import type { RollDieChange } from '../../utils/incomingReactions/incomingReactionEntry.js';
import type { RuleFormGroup } from './_formLayout.js';
import { RollUseRule } from './_rollUseRule.js';
import { withWidget } from './_widgetOption.js';
import { NimbleBaseRule } from './base.js';

/** Which die a Change a Die rule changes. */
const CHANGE_DICE = ['primaryDie', 'pickedDie'] as const;
type ChangeDie = (typeof CHANGE_DICE)[number];

/** How it changes the die: set it to a face the player picks, or add a number. */
const CHANGE_MODES = ['set', 'add'] as const;
type ChangeMode = (typeof CHANGE_MODES)[number];

function choiceLabels(field: string, values: readonly string[]): Record<string, string> {
	return Object.fromEntries(
		values.map((value) => [value, `NIMBLE.rules.changeDie.${field}.choices.${value}`]),
	);
}

function schema() {
	const { fields } = foundry.data;
	const shared = RollUseRule.rollUseSchema('changeDie');

	return {
		...shared.roll,
		die: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'primaryDie',
			choices: choiceLabels('die', CHANGE_DICE),
			label: 'NIMBLE.rules.changeDie.die.label',
			hint: 'NIMBLE.rules.changeDie.die.hint',
		}),
		change: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: 'set',
				choices: choiceLabels('change', CHANGE_MODES),
				label: 'NIMBLE.rules.changeDie.change.label',
				hint: 'NIMBLE.rules.changeDie.change.hint',
				widget: 'chips',
			}),
		),
		amount: new fields.NumberField(
			withWidget({
				required: true,
				nullable: false,
				initial: 1,
				integer: true,
				label: 'NIMBLE.rules.changeDie.amount.label',
				hint: 'NIMBLE.rules.changeDie.amount.hint',
				showWhen: (data: Record<string, unknown>) => data.change === 'add',
			}),
		),
		...shared.when,
		...shared.cost,
		...shared.note,
		type: new fields.StringField({ required: true, nullable: false, initial: 'changeDie' }),
	};
}

declare namespace ChangeDieRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/**
 * Lets the one who rolled, the target, or an ally change one die of a roll
 * after it is made: set it to a face the player picks, or add a number to
 * it. Crit and miss are worked out again. Always a choice, never automatic.
 * Read when a card is posted and again on the GM client when it is used.
 */
class ChangeDieRule extends RollUseRule<ChangeDieRule.Schema> {
	static override group = 'triggers';
	static override description = 'NIMBLE.rules.changeDie.description';
	static override formLayout: readonly RuleFormGroup[] = [
		RollUseRule.rollFormGroup(),
		...RollUseRule.useFormGroups([{ fields: ['die', 'change', 'amount'] }]),
		RollUseRule.noteFormGroup(),
	];

	declare die: ChangeDie;
	declare change: ChangeMode;
	declare amount: number;

	static override defineSchema(): ChangeDieRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				...RollUseRule.rollUseTooltipTypes(),
				['die', 'string'],
				['change', 'string'],
				['amount', 'number'],
			]),
		);
	}

	/** The change one use makes. An add of 0 is an add of 1. */
	get dieChange(): RollDieChange {
		if (this.change !== 'add') return { mode: 'set', amount: 0 };
		return { mode: 'add', amount: Math.trunc(Number(this.amount)) || 1 };
	}
}

export { ChangeDieRule };
