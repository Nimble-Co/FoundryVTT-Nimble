import {
	REROLL_DICE,
	REROLL_KEEPS,
	type RerollDie,
	type RerollKeep,
} from '../../utils/incomingReactions/incomingReactionEntry.js';
import type { RerollCost } from '../../utils/reroll/rerollCost.js';
import type { RerollChanges } from '../../utils/reroll/rerollOptions.js';
import type { RollUseKind } from '../../utils/reroll/rollToReroll.js';
import type { RuleFormGroup } from './_formLayout.js';
import { choiceLabels, type RollUseContext, RollUseRule } from './_rollUseRule.js';
import { withWidget } from './_widgetOption.js';
import { NimbleBaseRule } from './base.js';

// Outcomes whose first roll can be a crit.
const CRIT_OUTCOMES = new Set(['always', 'hit', 'criticalHit']);

// A reroll that needs a choice from someone can never happen by itself.
function nobodyChooses(data: Record<string, unknown>): boolean {
	return (
		data.usedBy !== 'ally' &&
		data.die !== 'pickedDie' &&
		(data.keep ?? 'new') === 'new' &&
		data.useAnotherStat !== true
	);
}

const forAttacks = (data: Record<string, unknown>) =>
	Array.isArray(data.rolls) && data.rolls.includes('attack');

// Roll changes apply to a new roll of the whole formula only.
/** The roll mode change choices: none, advantage or disadvantage. */
const ROLL_MODE_CHANGE_CHOICES = {
	0: 'NIMBLE.rules.reroll.rollModeChange.choices.none',
	1: 'NIMBLE.rules.reroll.rollModeChange.choices.advantage',
	[-1]: 'NIMBLE.rules.reroll.rollModeChange.choices.disadvantage',
};

const wholeRoll = (data: Record<string, unknown>) => (data.die ?? 'wholeRoll') === 'wholeRoll';
const forWholeAttackRolls = (data: Record<string, unknown>) => forAttacks(data) && wholeRoll(data);

function schema() {
	const { fields } = foundry.data;

	const shared = RollUseRule.rollUseSchemaParts('reroll');

	return {
		...shared.roll,
		...shared.related,
		die: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'wholeRoll',
			choices: choiceLabels('reroll', 'die', REROLL_DICE),
			label: 'NIMBLE.rules.reroll.die.label',
			hint: 'NIMBLE.rules.reroll.die.hint',
		}),
		maxDice: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: '',
				label: 'NIMBLE.rules.reroll.maxDice.label',
				hint: 'NIMBLE.rules.reroll.maxDice.hint',
				widget: 'formula',
				showWhen: (data: Record<string, unknown>) => data.die === 'pickedDie',
			}),
		),
		perDie: new fields.BooleanField(
			withWidget({
				required: true,
				nullable: false,
				initial: false,
				label: 'NIMBLE.rules.reroll.perDie.label',
				hint: 'NIMBLE.rules.reroll.perDie.hint',
				showWhen: (data: Record<string, unknown>) =>
					data.die === 'pickedDie' && !!String(data.maxDice ?? '').trim(),
			}),
		),
		keep: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'new',
			choices: choiceLabels('reroll', 'keep', REROLL_KEEPS),
			label: 'NIMBLE.rules.reroll.keep.label',
			hint: 'NIMBLE.rules.reroll.keep.hint',
		}),
		useAnotherStat: new fields.BooleanField(
			withWidget({
				required: true,
				nullable: false,
				initial: false,
				label: 'NIMBLE.rules.reroll.useAnotherStat.label',
				hint: 'NIMBLE.rules.reroll.useAnotherStat.hint',
				showWhen: wholeRoll,
			}),
		),
		...shared.when,
		...shared.cost,
		rollModeChange: new fields.NumberField(
			withWidget({
				required: true,
				nullable: false,
				initial: 0,
				min: -1,
				max: 1,
				integer: true,
				choices: ROLL_MODE_CHANGE_CHOICES,
				label: 'NIMBLE.rules.reroll.rollModeChange.label',
				hint: 'NIMBLE.rules.reroll.rollModeChange.hint',
				showWhen: wholeRoll,
			}),
		),
		primaryDieBonus: new fields.NumberField(
			withWidget({
				required: true,
				nullable: false,
				initial: 0,
				integer: true,
				label: 'NIMBLE.rules.reroll.primaryDieBonus.label',
				hint: 'NIMBLE.rules.reroll.primaryDieBonus.hint',
				showWhen: forWholeAttackRolls,
			}),
		),
		extraDamage: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: '',
				label: 'NIMBLE.rules.reroll.extraDamage.label',
				hint: 'NIMBLE.rules.reroll.extraDamage.hint',
				widget: 'diceFormula',
				showWhen: forWholeAttackRolls,
			}),
		),
		automatic: new fields.BooleanField(
			withWidget({
				required: true,
				nullable: false,
				initial: false,
				label: 'NIMBLE.rules.reroll.automatic.label',
				hint: 'NIMBLE.rules.reroll.automatic.hint',
				showWhen: nobodyChooses,
			}),
		),
		discardedCritTriggers: new fields.BooleanField(
			withWidget({
				required: true,
				nullable: false,
				initial: false,
				label: 'NIMBLE.rules.reroll.discardedCritTriggers.label',
				hint: 'NIMBLE.rules.reroll.discardedCritTriggers.hint',
				showWhen: (data: Record<string, unknown>) =>
					forAttacks(data) && CRIT_OUTCOMES.has(String(data.outcome)),
			}),
		),
		...shared.note,
		type: new fields.StringField({ required: true, nullable: false, initial: 'reroll' }),
	};
}

declare namespace RerollRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/**
 * Lets the one who rolled, or the target, discard a roll and roll it again.
 * The second result stands. Read by the attack pipeline when a card is posted
 * and again on the GM client when the reroll is used, never during data
 * preparation.
 */
class RerollRule extends RollUseRule<RerollRule.Schema> {
	static override group = 'triggers';
	static override description = 'NIMBLE.rules.reroll.description';
	static override formLayout: readonly RuleFormGroup[] = [
		RollUseRule.rollFormGroup(['relatedStat']),
		...RollUseRule.useFormGroups([
			{ fields: ['die', 'maxDice', 'perDie', 'keep', 'useAnotherStat'] },
		]),
		{
			label: 'NIMBLE.rules.reroll.form.changes.label',
			hint: 'NIMBLE.rules.reroll.form.changes.hint',
			fields: ['rollModeChange', 'primaryDieBonus', 'extraDamage'],
		},
		{ fields: ['automatic', 'discardedCritTriggers'] },
		RollUseRule.noteFormGroup(),
	];

	declare automatic: boolean;
	declare discardedCritTriggers: boolean;
	declare rollModeChange: number;
	declare primaryDieBonus: number;
	declare extraDamage: string;
	declare die: RerollDie;
	declare maxDice: string;
	declare perDie: boolean;
	declare keep: RerollKeep;
	declare useAnotherStat: boolean;

	static override defineSchema(): RerollRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				...RollUseRule.rollUseTooltipTypes(),
				['relatedStat', 'string'],
				['automatic', 'boolean'],
				['discardedCritTriggers', 'boolean'],
				['rollModeChange', 'number'],
				['primaryDieBonus', 'number'],
				['extraDamage', 'string'],
				['die', 'string'],
				['maxDice', 'string'],
				['perDie', 'boolean'],
				['keep', 'string'],
				['useAnotherStat', 'boolean'],
			]),
		);
	}

	/** The most dice one use can reroll. Null when the rule rerolls one die or the whole roll. */
	get maxDiceCount(): number | null {
		const formula = (this.maxDice ?? '').trim();
		if (!formula || this.die !== 'pickedDie') return null;
		return Math.max(0, Math.trunc(Number(this.resolveFormula(formula)) || 0));
	}

	override get rollUseCost(): RerollCost {
		return { ...super.rollUseCost, ...(this.perDie ? { perDie: true } : {}) };
	}

	/** Whether the rule rerolls with no button. Never when someone has a choice to make. */
	get rerollsByItself(): boolean {
		return this.automatic === true && nobodyChooses(this as unknown as Record<string, unknown>);
	}

	/** Whether the player picks another stat for the new roll. Only a whole roll has a stat part. */
	get usesAnotherStat(): boolean {
		return this.useAnotherStat === true && (this.die ?? 'wholeRoll') === 'wholeRoll';
	}

	override offersUseOn(context: RollUseContext): boolean {
		if (!super.offersUseOn(context)) return false;
		if (this.maxDiceCount === 0) return false;
		const { roll } = context;
		return !this.usesAnotherStat || roll.kind !== 'attack' || (roll.stats?.length ?? 0) > 0;
	}

	/**
	 * The changes this rule adds to the new roll. Extra damage reads this
	 * rule's actor. Only an attack gets the attack changes.
	 */
	rerollChanges(kind: RollUseKind): RerollChanges {
		if ((this.die ?? 'wholeRoll') !== 'wholeRoll') {
			return { rollModeChange: 0, primaryDieBonus: 0, extraDamage: '' };
		}
		const attackChanges = kind === 'attack' && this.rolls?.includes('attack') === true;
		const formula = attackChanges ? (this.extraDamage ?? '').trim() : '';
		const extraDamage = formula
			? Roll.replaceFormulaData(formula, this.actor?.getRollData() ?? {}, { missing: '0' })
			: '';
		return {
			rollModeChange: Number(this.rollModeChange) || 0,
			primaryDieBonus: attackChanges ? Number(this.primaryDieBonus) || 0 : 0,
			extraDamage,
		};
	}
}

export { RerollRule, ROLL_MODE_CHANGE_CHOICES };
