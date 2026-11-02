import type { DieChange } from '#types/dieChange.d.ts';
import {
	DIE_CHANGE_MODES,
	type DieChangeMode,
} from '../../utils/incomingReactions/incomingReactionEntry.js';
import type { RuleFormGroup } from './_formLayout.js';
import { choiceLabels, type RollUseContext, RollUseRule } from './_rollUseRule.js';
import { withWidget } from './_widgetOption.js';
import { NimbleBaseRule } from './base.js';

/** Which die a Change a Die rule changes. */
const CHANGE_DICE = ['primaryDie', 'pickedDie', 'sneakAttackDie'] as const;
type ChangeDie = (typeof CHANGE_DICE)[number];

function schema() {
	const { fields } = foundry.data;
	const shared = RollUseRule.rollUseSchemaParts('changeDie');

	return {
		...shared.roll,
		die: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'primaryDie',
			choices: choiceLabels('changeDie', 'die', CHANGE_DICE),
			label: 'NIMBLE.rules.changeDie.die.label',
			hint: 'NIMBLE.rules.changeDie.die.hint',
		}),
		change: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: 'set',
				choices: choiceLabels('changeDie', 'change', DIE_CHANGE_MODES),
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
				validate: (value: unknown) => value !== 0,
				validationError: 'cannot be 0',
				label: 'NIMBLE.rules.changeDie.amount.label',
				hint: 'NIMBLE.rules.changeDie.amount.hint',
				showWhen: (data: Record<string, unknown>) => data.change === 'add',
			}),
		),
		rowPerUpcastStep: new fields.BooleanField({
			required: true,
			nullable: false,
			initial: false,
			label: 'NIMBLE.rules.changeDie.rowPerUpcastStep.label',
			hint: 'NIMBLE.rules.changeDie.rowPerUpcastStep.hint',
		}),
		yieldsTo: new fields.StringField({
			required: true,
			nullable: false,
			initial: '',
			label: 'NIMBLE.rules.changeDie.yieldsTo.label',
			hint: 'NIMBLE.rules.changeDie.yieldsTo.hint',
		}),
		addsBonusOnSet: new fields.BooleanField(
			withWidget({
				required: true,
				nullable: false,
				initial: false,
				label: 'NIMBLE.rules.changeDie.addsBonusOnSet.label',
				hint: 'NIMBLE.rules.changeDie.addsBonusOnSet.hint',
				showWhen: (data: Record<string, unknown>) => data.change === 'set',
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
		...RollUseRule.useFormGroups([
			{ fields: ['die', 'change', 'amount', 'addsBonusOnSet', 'rowPerUpcastStep', 'yieldsTo'] },
		]),
		RollUseRule.noteFormGroup(),
	];

	declare die: ChangeDie;
	declare change: DieChangeMode;
	declare amount: number;
	declare addsBonusOnSet: boolean;
	declare rowPerUpcastStep: boolean;
	declare yieldsTo: string;

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
				['addsBonusOnSet', 'boolean'],
				['rowPerUpcastStep', 'boolean'],
				['yieldsTo', 'string'],
			]),
		);
	}

	/** One row per upcast step of the attack, when the rule says so. */
	rowsOn(context: Pick<RollUseContext, 'roll'>): number {
		if (!this.rowPerUpcastStep) return 1;
		return context.roll.kind === 'attack' ? (context.roll.upcastSteps ?? 0) : 0;
	}

	/** The rule of the same actor with the identifier `yieldsTo` takes this row's place while it can be used. */
	override offersUseOn(context: RollUseContext): boolean {
		if (!super.offersUseOn(context)) return false;
		if (this.rowPerUpcastStep && this.rowsOn(context) === 0) return false;
		const other = (this.yieldsTo ?? '').trim();
		if (!other) return true;
		const rules = (this.actor as { rules?: Iterable<ChangeDieRule> } | null)?.rules ?? [];
		return !Array.from(rules).some(
			(rule) => rule !== this && rule.identifier === other && rule.offersUseOn?.(context) === true,
		);
	}

	/** Only a roll with dice of the sneak attack role has a use for a rule that changes them. */
	get needsSneakDice(): boolean {
		return this.die === 'sneakAttackDie';
	}

	/** The change one use makes. An add of 0 is an add of 1. */
	get dieChange(): DieChange {
		if (this.change !== 'add') {
			return { mode: 'set', value: 0, ...(this.addsBonusOnSet ? { addsBonus: true } : {}) };
		}
		return { mode: 'add', value: Math.trunc(Number(this.amount)) || 1 };
	}
}

export { ChangeDieRule };
