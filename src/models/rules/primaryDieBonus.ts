import type { OtherCreature } from '#types/otherCreature.d.ts';
import type { Predicate } from '../../etc/Predicate.js';
import {
	ATTACK_DELIVERY_FILTERS,
	type AttackDelivery,
	type AttackDeliveryFilter,
	matchesAttackDelivery,
} from '../../utils/damage/attackDelivery.js';
import { PredicateField } from '../fields/PredicateField.js';
import type { RuleFormGroup } from './_formLayout.js';
import { ruleOtherCreatureMatches } from './_otherCreatureMatches.js';
import { choiceLabels } from './_rollUseRule.js';
import { withWidget } from './_widgetOption.js';
import { NimbleBaseRule } from './base.js';

function schema() {
	const { fields } = foundry.data;

	return {
		value: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: '1',
				label: 'NIMBLE.rules.primaryDieBonus.value.label',
				hint: 'NIMBLE.rules.primaryDieBonus.value.hint',
				widget: 'formula',
			}),
		),
		attackDelivery: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'any',
			choices: choiceLabels('reroll', 'attackDelivery', ATTACK_DELIVERY_FILTERS),
			label: 'NIMBLE.rules.reroll.attackDelivery.label',
			hint: 'NIMBLE.rules.reroll.attackDelivery.hint',
		}),
		otherCreature: new PredicateField({
			label: 'NIMBLE.rules.primaryDieBonus.otherCreature.label',
			hint: 'NIMBLE.rules.primaryDieBonus.otherCreature.hint',
		}),
		type: new fields.StringField({ required: true, nullable: false, initial: 'primaryDieBonus' }),
	};
}

declare namespace PrimaryDieBonusRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/** The attack a bonus is asked about: how it is delivered, and the target. */
interface PrimaryDieBonusContext {
	delivery: AttackDelivery;
	other: OtherCreature | null | undefined;
}

/**
 * Adds a number to the Primary Die of the owner's attack rolls, with the
 * activation dialog's "Add to Primary Die Result". Read when the attack is
 * rolled, never during data preparation.
 */
class PrimaryDieBonusRule extends NimbleBaseRule<PrimaryDieBonusRule.Schema> {
	static override group = 'bonuses';
	static override description = 'NIMBLE.rules.primaryDieBonus.description';
	static override formLayout: readonly RuleFormGroup[] = [
		{ fields: ['value'] },
		{ fields: ['attackDelivery'] },
		{
			label: 'NIMBLE.rules.reroll.form.onlyWhile.label',
			hint: 'NIMBLE.rules.reroll.form.onlyWhile.hint',
			fields: ['predicate'],
		},
		{ fields: ['otherCreature'] },
	];

	declare value: string;
	declare attackDelivery: AttackDeliveryFilter;
	declare otherCreature: Predicate;

	static override defineSchema(): PrimaryDieBonusRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['value', 'string'],
				['attackDelivery', 'string'],
				['otherCreature', 'object'],
			]),
		);
	}

	/** The number this rule adds to the Primary Die of this attack. 0 when it does not apply. */
	bonusFor(context: PrimaryDieBonusContext): number {
		if (!this.item.isEmbedded || !context.delivery) return 0;
		if (!this.test()) return 0;
		if (!matchesAttackDelivery(this.attackDelivery, context.delivery)) return 0;
		if (!ruleOtherCreatureMatches(this, this.otherCreature, context.other)) return 0;
		return Math.trunc(Number(this.resolveFormula(this.value ?? '')) || 0);
	}
}

export { PrimaryDieBonusRule };
