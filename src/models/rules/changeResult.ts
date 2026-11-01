import getDeterministicBonus from '../../dice/getDeterministicBonus.js';
import {
	RESULT_CHANGES,
	type ResultCardView,
	type ResultChangeKind,
	type ResultUse,
} from '../../utils/incomingReactions/incomingReactionEntry.js';
import type { RerollRollKind } from '../../utils/reroll/rollToReroll.js';
import { standingResultChanges } from '../../utils/rolls/resultChanges.js';
import type { RuleFormGroup } from './_formLayout.js';
import { choiceLabels, type RollUseContext, RollUseRule } from './_rollUseRule.js';
import { withWidget } from './_widgetOption.js';
import { NimbleBaseRule } from './base.js';

const CHECK_ROLLS = ['save', 'skillCheck', 'abilityCheck'] as const satisfies RerollRollKind[];

function schema() {
	const { fields } = foundry.data;
	const shared = RollUseRule.rollUseSchemaParts('changeResult');
	// An attack has no result to change yet, and one check can use the rule again.
	const { oncePerAttack: _oncePerAttack, ...cost } = shared.cost;

	return {
		...shared.roll,
		rolls: new fields.ArrayField(
			new fields.StringField({
				required: true,
				nullable: false,
				choices: choiceLabels('reroll', 'rolls', CHECK_ROLLS),
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
				showWhen: (data: Record<string, unknown>) => data.change !== 'succeed',
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
		...cost,
		...shared.note,
		type: new fields.StringField({ required: true, nullable: false, initial: 'changeResult' }),
	};
}

declare namespace ChangeResultRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/**
 * Lets the one who rolled or an ally change the result of a save or a check
 * after it is made: it succeeds, its total becomes a formula, or a formula goes
 * on its total. Always a choice, never automatic. Read when a card is posted and
 * again on the GM client when it is used.
 */
class ChangeResultRule extends RollUseRule<ChangeResultRule.Schema> {
	static override group = 'triggers';
	static override description = 'NIMBLE.rules.changeResult.description';
	static override formLayout: readonly RuleFormGroup[] = [
		RollUseRule.rollFormGroup(),
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
				['change', 'string'],
				['formula', 'string'],
				['onlyIfLower', 'boolean'],
			]),
		);
	}

	protected override usesOnRolls(): readonly RerollRollKind[] {
		return (this.rolls ?? []).filter((kind) => kind !== 'attack');
	}

	/** What one use does, read against the one who rolled. Null when the formula gives no number. */
	resultUseFor(roller: ResultCardView['roller']): ResultUse | null {
		if (this.change === 'succeed') return { change: 'succeed', value: 0, stat: '' };
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
		const { card } = context;
		if (!card) return true;
		if (this.change === 'succeed') return !this.succeedStandsOn(card);
		const use = this.resultUseFor(card.roller);
		if (!use) return false;
		if (this.change !== 'setTotal') return true;
		// A click at this value would change nothing and still cost its price.
		return this.onlyIfLower ? card.total < use.value : card.total !== use.value;
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
