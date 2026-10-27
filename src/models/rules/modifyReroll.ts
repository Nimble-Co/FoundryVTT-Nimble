import type { RuleFormGroup } from './_formLayout.js';
import { withWidget } from './_widgetOption.js';
import { NimbleBaseRule } from './base.js';
import { ROLL_MODE_CHANGE_CHOICES } from './reroll.js';

const givesTempHp = (data: Record<string, unknown>) =>
	typeof data.tempHp === 'string' && data.tempHp.trim() !== '';

function schema() {
	const { fields } = foundry.data;

	return {
		rerollIdentifier: new fields.StringField({
			required: true,
			nullable: false,
			initial: '',
			label: 'NIMBLE.rules.modifyReroll.rerollIdentifier.label',
			hint: 'NIMBLE.rules.modifyReroll.rerollIdentifier.hint',
		}),
		rollModeChange: new fields.NumberField({
			required: true,
			nullable: false,
			initial: 0,
			min: -1,
			max: 1,
			integer: true,
			choices: ROLL_MODE_CHANGE_CHOICES,
			label: 'NIMBLE.rules.modifyReroll.rollModeChange.label',
			hint: 'NIMBLE.rules.modifyReroll.rollModeChange.hint',
		}),
		extraDamage: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: '',
				label: 'NIMBLE.rules.modifyReroll.extraDamage.label',
				hint: 'NIMBLE.rules.modifyReroll.extraDamage.hint',
				widget: 'diceFormula',
			}),
		),
		actionsForRoller: new fields.NumberField({
			required: true,
			nullable: false,
			initial: 0,
			min: 0,
			integer: true,
			label: 'NIMBLE.rules.modifyReroll.actionsForRoller.label',
			hint: 'NIMBLE.rules.modifyReroll.actionsForRoller.hint',
		}),
		tempHp: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: '',
				label: 'NIMBLE.rules.modifyReroll.tempHp.label',
				hint: 'NIMBLE.rules.modifyReroll.tempHp.hint',
				widget: 'diceFormula',
			}),
		),
		tempHpWithin: new fields.NumberField(
			withWidget({
				required: true,
				nullable: false,
				initial: 0,
				min: 0,
				integer: true,
				label: 'NIMBLE.rules.modifyReroll.tempHpWithin.label',
				hint: 'NIMBLE.rules.modifyReroll.tempHpWithin.hint',
				showWhen: givesTempHp,
			}),
		),
		type: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'modifyReroll',
		}),
	};
}

declare namespace ModifyRerollRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/**
 * Passive data rule that adds to a `reroll` rule on the same actor, found by
 * `rerollIdentifier`. It has no lifecycle hooks; the reroll code reads it
 * when the reroll is used.
 */
class ModifyRerollRule extends NimbleBaseRule<ModifyRerollRule.Schema> {
	static override group = 'triggers';
	static override description = 'NIMBLE.rules.modifyReroll.description';
	static override formLayout: readonly RuleFormGroup[] = [
		{ fields: ['rerollIdentifier'] },
		{
			label: 'NIMBLE.rules.modifyReroll.form.roll.label',
			hint: 'NIMBLE.rules.modifyReroll.form.roll.hint',
			fields: ['rollModeChange', 'extraDamage'],
		},
		{
			label: 'NIMBLE.rules.modifyReroll.form.creatures.label',
			hint: 'NIMBLE.rules.modifyReroll.form.creatures.hint',
			fields: ['actionsForRoller', 'tempHp', 'tempHpWithin'],
		},
	];

	declare rerollIdentifier: string;
	declare rollModeChange: number;
	declare extraDamage: string;
	declare actionsForRoller: number;
	declare tempHp: string;
	declare tempHpWithin: number;

	static override defineSchema(): ModifyRerollRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['rerollIdentifier', 'string'],
				['rollModeChange', '-1 | 0 | 1'],
				['extraDamage', 'string'],
				['actionsForRoller', 'number'],
				['tempHp', 'string'],
				['tempHpWithin', 'number'],
			]),
		);
	}
}

export { ModifyRerollRule };
