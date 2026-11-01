import getDeterministicBonus from '../../dice/getDeterministicBonus.js';
import { isRuleAutomationEnabled } from '../../settings/automationSettings.js';
import {
	RESULT_CHANGES,
	type RerollTrigger,
	type ResultCardView,
	type ResultChangeKind,
	type ResultUse,
} from '../../utils/incomingReactions/incomingReactionEntry.js';
import type { RerollRollKind, RollToReroll, RollUseKind } from '../../utils/reroll/rollToReroll.js';
import { standingResultChanges } from '../../utils/rolls/resultChanges.js';
import type { RuleFormGroup } from './_formLayout.js';
import { choiceLabels, type RollUseContext, RollUseRule } from './_rollUseRule.js';
import { withWidget } from './_widgetOption.js';
import { NimbleBaseRule } from './base.js';

const CHECK_ROLLS = ['save', 'skillCheck', 'abilityCheck'] as const satisfies RerollRollKind[];
const NATURAL_20 = 20;
const LOW_RESULT = 1;

const usesFormula = (data: Record<string, unknown>) =>
	data.change === 'setTotal' || data.change === 'add';
const waitsForFailed = (data: Record<string, unknown>) =>
	(data.change ?? 'succeed') === 'succeed' || data.change === 'add';

function schema() {
	const { fields } = foundry.data;
	const shared = RollUseRule.rollUseSchemaParts('changeResult');
	// One roll can use the rule again.
	const { oncePerAttack: _oncePerAttack, ...cost } = shared.cost;

	return {
		...shared.roll,
		...shared.related,
		rolls: new fields.ArrayField(
			new fields.StringField({
				required: true,
				nullable: false,
				choices: {
					...choiceLabels('reroll', 'rolls', CHECK_ROLLS),
					...choiceLabels('changeResult', 'rolls', ['initiative']),
					...choiceLabels('reroll', 'rolls', ['attack']),
				},
			}),
			{
				required: true,
				nullable: false,
				initial: ['save'],
				label: 'NIMBLE.rules.changeResult.rolls.label',
			},
		),
		change: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: 'succeed',
				choices: choiceLabels('changeResult', 'change', RESULT_CHANGES),
				label: 'NIMBLE.rules.changeResult.change.label',
				hint: 'NIMBLE.rules.changeResult.change.hint',
				widget: 'chips',
			}),
		),
		formula: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: '',
				label: 'NIMBLE.rules.changeResult.formula.label',
				hint: 'NIMBLE.rules.changeResult.formula.hint',
				widget: 'formula',
				showWhen: usesFormula,
			}),
		),
		onlyIfLower: new fields.BooleanField(
			withWidget({
				required: true,
				nullable: false,
				initial: false,
				label: 'NIMBLE.rules.changeResult.onlyIfLower.label',
				hint: 'NIMBLE.rules.changeResult.onlyIfLower.hint',
				showWhen: (data: Record<string, unknown>) => data.change === 'setTotal',
			}),
		),
		...shared.when,
		outcome: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: 'failed',
				choices: choiceLabels('changeResult', 'outcome', ['failed', 'always']),
				label: 'NIMBLE.rules.changeResult.outcome.label',
				hint: 'NIMBLE.rules.changeResult.outcome.hint',
				showWhen: waitsForFailed,
			}),
		),
		...cost,
		...shared.note,
		type: new fields.StringField({ required: true, nullable: false, initial: 'changeResult' }),
	};
}

declare namespace ChangeResultRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/**
 * Changes the result of a roll after it is made: a save, a check or Initiative
 * succeeds, its total becomes a formula, or a formula goes on its total; a target
 * takes no damage from an attack; a low result counts as a natural 20. The last
 * happens by itself while Feature Effects is on, the others are always a choice. Read
 * when a card is posted and again on the GM client when it is used.
 */
class ChangeResultRule extends RollUseRule<ChangeResultRule.Schema> {
	static override group = 'triggers';
	static override description = 'NIMBLE.rules.changeResult.description';
	static override formLayout: readonly RuleFormGroup[] = [
		RollUseRule.rollFormGroup(['relatedStat']),
		...RollUseRule.useFormGroups([{ fields: ['change', 'formula', 'onlyIfLower'] }]),
		RollUseRule.noteFormGroup(),
	];

	declare change: ResultChangeKind;
	declare formula: string;
	declare onlyIfLower: boolean;

	static override defineSchema(): ChangeResultRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				...RollUseRule.rollUseTooltipTypes().filter(([name]) => name !== 'oncePerAttack'),
				['relatedStat', 'string'],
				['change', 'string'],
				['formula', 'string'],
				['onlyIfLower', 'boolean'],
			]),
		);
	}

	protected override usesOnRolls(): readonly RollUseKind[] {
		const rolls = this.rolls ?? [];
		if (this.change === 'noDamage') return rolls.filter((kind) => kind === 'attack');
		if (this.change === 'countsAsNat20') {
			return rolls.filter((kind) => kind === 'save' || kind === 'skillCheck');
		}
		return rolls.filter((kind) => kind !== 'attack');
	}

	protected override waitsForFailure(): boolean {
		return waitsForFailed({ change: this.change }) && this.outcome === 'failed';
	}

	/** A row for no damage needs a hit: a miss deals none. */
	get attackTrigger(): RerollTrigger {
		return 'hit';
	}

	/** Whether a total of 1 or less on this roll counts as a natural 20. It costs nothing. */
	countsAsNat20On(roll: RollToReroll): boolean {
		return this.change === 'countsAsNat20' && this.coversRoll({ side: 'roller', roll });
	}

	/** What one use does, read against the one who rolled. Null when the formula gives no number. */
	resultUseFor(roller: ResultCardView['roller'], card?: ResultCardView): ResultUse | null {
		if (this.change === 'succeed') return { change: 'succeed', value: 0, stat: '' };
		if (this.change === 'noDamage') return { change: 'noDamage', value: 0, stat: '' };
		if (this.change === 'countsAsNat20') {
			return { change: 'countsAsNat20', value: NATURAL_20 + (card?.rollModifier ?? 0), stat: '' };
		}
		const formula = (this.formula ?? '').trim();
		if (!formula) return null;
		const value = this.formulaValue(formula, roller);
		if (value === null || !Number.isFinite(value)) return null;
		return { change: this.change, value, stat: this.statOf(formula) };
	}

	/** Runs while a card draws, so a formula the roller has no data for must not throw. */
	private formulaValue(formula: string, roller: ResultCardView['roller']): number | null {
		try {
			return getDeterministicBonus(formula, (roller?.getRollData?.() ?? {}) as never);
		} catch {
			return null;
		}
	}

	/** A formula that is one ability names it on the card, so the rule needs no field for the words. */
	private statOf(formula: string): string {
		const key = /^@(\w+)$/.exec(formula)?.[1] ?? '';
		return key in CONFIG.NIMBLE.abilityScores ? key : '';
	}

	override offersUseOn(context: RollUseContext): boolean {
		if (!super.offersUseOn(context)) return false;
		// Initiative has no result to succeed.
		if (context.roll.kind === 'initiative' && this.change === 'succeed') return false;
		if (this.change === 'noDamage') return this.offersNoDamage(context);
		if (this.change === 'countsAsNat20') return this.offersNat20(context);
		const { card } = context;
		if (!card) return true;
		if (this.change === 'succeed') return !this.succeedStandsOn(card);
		const use = this.resultUseFor(card.roller);
		if (!use) return false;
		if (this.change !== 'setTotal') return true;
		// A click at this value would change nothing and still cost its price.
		return this.onlyIfLower ? card.total < use.value : card.total !== use.value;
	}

	/** A target's own row, while the damage is still to come and no change covers that target. */
	private offersNoDamage({ side, card, targetTokenUuid }: RollUseContext): boolean {
		if (side !== 'target') return false;
		if (!card) return true;
		if (card.damageApplied === true) return false;
		return !standingResultChanges(card.changes).some(
			(change) => change.change === 'noDamage' && change.targetTokenUuid === targetTokenUuid,
		);
	}

	/** With Feature Effects on it happens by itself, so it has no row. */
	private offersNat20({ side, card }: RollUseContext): boolean {
		if (side !== 'roller' || isRuleAutomationEnabled()) return false;
		if (!card) return true;
		const stands = standingResultChanges(card.changes).some(
			(change) => change.change === 'countsAsNat20',
		);
		return !stands && card.total <= LOW_RESULT;
	}

	private succeedStandsOn(card: ResultCardView): boolean {
		return standingResultChanges(card.changes).some(
			(change) =>
				change.change === 'succeed' &&
				change.ruleId === this.id &&
				change.itemUuid === this.item.uuid,
		);
	}
}

export { ChangeResultRule };
