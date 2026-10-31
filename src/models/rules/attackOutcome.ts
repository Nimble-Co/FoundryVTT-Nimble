import type { ForcedCritKind } from '#types/attackOutcome.d.ts';
import type { OtherCreature } from '#types/otherCreature.d.ts';
import type { Predicate } from '../../etc/Predicate.js';
import { hasRuleCharge } from '../../utils/chargePool/ruleChargeGate.js';
import {
	ATTACK_DELIVERY_FILTERS,
	type AttackDelivery,
	type AttackDeliveryFilter,
	matchesAttackDelivery,
} from '../../utils/damage/attackDelivery.js';
import { attackTags } from '../../utils/damage/attackTags.js';
import type { RerollTrigger } from '../../utils/incomingReactions/incomingReactionEntry.js';
import type { RerollCost } from '../../utils/reroll/rerollCost.js';
import { PredicateField } from '../fields/PredicateField.js';
import type { RuleFormGroup } from './_formLayout.js';
import { ruleOtherCreatureMatches } from './_otherCreatureMatches.js';
import { choiceLabels, type RollUseContext } from './_rollUseRule.js';
import { withWidget } from './_widgetOption.js';
import { NimbleBaseRule } from './base.js';

const ATTACK_OUTCOME_SIDES = ['yourAttacks', 'attacksAgainstYou'] as const;
type AttackOutcomeSide = (typeof ATTACK_OUTCOME_SIDES)[number];

const FORCE_CRIT_CHOICES = ['none', 'always', 'onHit'] as const;
type ForceCritChoice = (typeof FORCE_CRIT_CHOICES)[number];

const onYourAttacks = (data: Record<string, unknown>) => data.side !== 'attacksAgainstYou';

function schema() {
	const { fields } = foundry.data;

	return {
		side: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: 'yourAttacks',
				choices: choiceLabels('attackOutcome', 'side', ATTACK_OUTCOME_SIDES),
				label: 'NIMBLE.rules.attackOutcome.side.label',
				hint: 'NIMBLE.rules.attackOutcome.side.hint',
				widget: 'chips',
			}),
		),
		cannotMiss: new fields.BooleanField({
			required: true,
			nullable: false,
			initial: false,
			label: 'NIMBLE.rules.attackOutcome.cannotMiss.label',
			hint: 'NIMBLE.rules.attackOutcome.cannotMiss.hint',
		}),
		critRange: new fields.NumberField({
			required: true,
			nullable: false,
			initial: 0,
			integer: true,
			min: 0,
			label: 'NIMBLE.rules.attackOutcome.critRange.label',
			hint: 'NIMBLE.rules.attackOutcome.critRange.hint',
		}),
		forceCrit: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'none',
			choices: choiceLabels('attackOutcome', 'forceCrit', FORCE_CRIT_CHOICES),
			label: 'NIMBLE.rules.attackOutcome.forceCrit.label',
			hint: 'NIMBLE.rules.attackOutcome.forceCrit.hint',
		}),
		anyDieCrits: new fields.BooleanField({
			required: true,
			nullable: false,
			initial: false,
			label: 'NIMBLE.rules.attackOutcome.anyDieCrits.label',
			hint: 'NIMBLE.rules.attackOutcome.anyDieCrits.hint',
		}),
		attackDelivery: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'any',
			choices: choiceLabels('reroll', 'attackDelivery', ATTACK_DELIVERY_FILTERS),
			label: 'NIMBLE.rules.reroll.attackDelivery.label',
			hint: 'NIMBLE.rules.reroll.attackDelivery.hint',
		}),
		thisItemOnly: new fields.BooleanField(
			withWidget({
				required: true,
				nullable: false,
				initial: false,
				label: 'NIMBLE.rules.attackOutcome.thisItemOnly.label',
				hint: 'NIMBLE.rules.attackOutcome.thisItemOnly.hint',
				showWhen: onYourAttacks,
			}),
		),
		otherCreature: new PredicateField({
			label: 'NIMBLE.rules.attackOutcome.otherCreature.label',
			hint: 'NIMBLE.rules.attackOutcome.otherCreature.hint',
		}),
		chargePoolIdentifier: new fields.StringField(
			withWidget({
				// Not required, so the picker lists an empty choice for no pool.
				required: false,
				nullable: false,
				initial: '',
				label: 'NIMBLE.rules.attackOutcome.chargePoolIdentifier.label',
				hint: 'NIMBLE.rules.attackOutcome.chargePoolIdentifier.hint',
				widget: 'chargePoolPicker',
				showWhen: onYourAttacks,
			}),
		),
		type: new fields.StringField({ required: true, nullable: false, initial: 'attackOutcome' }),
	};
}

declare namespace AttackOutcomeRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/** The attack a rule is asked about. */
interface AttackOutcomeContext {
	/** The side the rule's owner is on: the one who attacks, or the target. */
	side: AttackOutcomeSide;
	delivery: AttackDelivery | null;
	/** The creature on the other side: the target, or the one who attacks. */
	other: OtherCreature | null | undefined;
	/** The item the attack is made with. */
	itemUuid: string | null | undefined;
	/** The damage types of the attack, as `attack:damageType:<type>` tags for the predicate. */
	damageTypes?: readonly string[];
}

/** How a rule changes the way an attack roll is read. */
interface AttackOutcomeChange {
	label: string;
	cannotMiss: boolean;
	critRange: number;
	forcedCrit: ForcedCritKind | null;
	anyDieCrits: boolean;
	chargePoolIdentifier: string;
}

/**
 * Changes how the owner's attack rolls, or the attack rolls against the owner,
 * are read: the attack cannot miss, crits on a lower face, crits without the
 * max, or crits when any die rolls its max. Read when the attack is rolled,
 * with no choice; never during data preparation.
 */
class AttackOutcomeRule extends NimbleBaseRule<AttackOutcomeRule.Schema> {
	static override group = 'bonuses';
	static override description = 'NIMBLE.rules.attackOutcome.description';
	static override formLayout: readonly RuleFormGroup[] = [
		{ fields: ['side'] },
		{
			label: 'NIMBLE.rules.attackOutcome.form.changes',
			fields: ['cannotMiss', 'critRange', 'forceCrit', 'anyDieCrits'],
		},
		{
			label: 'NIMBLE.rules.attackOutcome.form.onlyAttacks',
			fields: ['attackDelivery', 'thisItemOnly'],
		},
		{
			label: 'NIMBLE.rules.reroll.form.onlyWhile.label',
			hint: 'NIMBLE.rules.attackOutcome.form.onlyWhileHint',
			fields: ['predicate'],
		},
		{ fields: ['otherCreature'] },
		{
			label: 'NIMBLE.rules.attackOutcome.form.limit',
			fields: ['chargePoolIdentifier'],
		},
	];

	declare side: AttackOutcomeSide;
	declare cannotMiss: boolean;
	declare critRange: number;
	declare forceCrit: ForceCritChoice;
	declare anyDieCrits: boolean;
	declare attackDelivery: AttackDeliveryFilter;
	declare thisItemOnly: boolean;
	declare otherCreature: Predicate;
	declare chargePoolIdentifier: string;

	static override defineSchema(): AttackOutcomeRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['side', 'string'],
				['cannotMiss', 'boolean'],
				['critRange', 'number'],
				['forceCrit', 'string'],
				['anyDieCrits', 'boolean'],
				['attackDelivery', 'string'],
				['thisItemOnly', 'boolean'],
				['otherCreature', 'object'],
				['chargePoolIdentifier', 'string'],
			]),
		);
	}

	/** How this rule changes the reading of this attack, or null when it does not apply. */
	changeFor(context: AttackOutcomeContext): AttackOutcomeChange | null {
		if (!this.item.isEmbedded || this.side !== context.side) return null;
		if (!this.test(this.domainWith(attackTags(context.damageTypes)))) return null;
		if (!matchesAttackDelivery(this.attackDelivery, context.delivery)) return null;
		const ownAttack = context.side === 'yourAttacks';
		if (ownAttack && this.thisItemOnly && context.itemUuid !== this.item.uuid) return null;
		if (!ruleOtherCreatureMatches(this, this.otherCreature, context.other)) return null;
		const chargePoolIdentifier = ownAttack ? (this.chargePoolIdentifier ?? '').trim() : '';
		if (!hasRuleCharge(this.actor as Actor | null, chargePoolIdentifier)) return null;

		return {
			label: this.label || this.item.name || '',
			cannotMiss: this.cannotMiss === true,
			critRange: Math.max(0, Math.trunc(Number(this.critRange) || 0)),
			forcedCrit: this.forceCrit === 'always' || this.forceCrit === 'onHit' ? this.forceCrit : null,
			anyDieCrits: this.anyDieCrits === true,
			chargePoolIdentifier,
		};
	}

	/**
	 * With Feature Effects off, a rule that gives a crit is a Make It a Crit
	 * button: whether `context.side` can use it on this attack now.
	 */
	offersUseOn(context: RollUseContext): boolean {
		const { roll } = context;
		if (roll.kind !== 'attack') return false;
		const sides = { roller: 'yourAttacks', target: 'attacksAgainstYou' } as const;
		const side = context.side === 'ally' ? null : sides[context.side];
		if (!side) return false;
		const change = this.changeFor({
			side,
			delivery: roll.delivery,
			other: context.other,
			itemUuid: roll.itemUuid,
		});
		return !!change && (change.forcedCrit !== null || change.anyDieCrits);
	}

	/** The attack result the button is used on: any for an "always" crit, else a hit. */
	get outcome(): RerollTrigger {
		return this.forceCrit === 'always' ? 'always' : 'hit';
	}

	/** The button also needs a die of the roll at its max. */
	get critNeedsDieAtMax(): boolean {
		return this.forceCrit === 'none' && this.anyDieCrits === true;
	}

	/** One charge of its pool, on your attacks only. */
	get rollUseCost(): RerollCost {
		return {
			chargePoolIdentifier:
				this.side === 'attacksAgainstYou' ? '' : (this.chargePoolIdentifier ?? '').trim(),
			chargeCost: 1,
			manaCost: 0,
			woundCost: 0,
			heroicReaction: '',
			actionCost: 0,
		};
	}
}

export { type AttackOutcomeChange, AttackOutcomeRule };
