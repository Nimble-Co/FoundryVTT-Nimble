import { type AttackDelivery, matchesAttackDelivery } from '../../utils/attackDelivery.js';
import { HEROIC_REACTIONS, type HeroicReactionKey } from '../../utils/heroicActions.js';
import type { RerollTrigger } from '../../utils/incomingReactionEntry.js';
import { canPayRerollCost, type RerollCost } from '../../utils/rerollCost.js';
import type { RerollChanges } from '../../utils/rerollOptions.js';
import { withWidget } from './_widgetOption.js';
import { NimbleBaseRule } from './base.js';

const REROLL_ROLLS = ['attack'] as const;
const REROLL_USERS = ['roller', 'target'] as const;
const REROLL_OUTCOMES = ['always', 'hit', 'criticalHit', 'nonCriticalHit', 'miss'] as const;
const REROLL_ATTACK_DELIVERIES = ['any', 'melee', 'ranged'] as const;

// Outcomes whose first roll can be a crit.
const CRIT_OUTCOMES = new Set(['always', 'hit', 'criticalHit']);

type RerollRoll = (typeof REROLL_ROLLS)[number];
type RerollUser = (typeof REROLL_USERS)[number];
type RerollAttackDelivery = (typeof REROLL_ATTACK_DELIVERIES)[number];

function choiceLabels(field: string, values: readonly string[]): Record<string, string> {
	return Object.fromEntries(
		values.map((value) => [value, `NIMBLE.rules.reroll.${field}.choices.${value || 'none'}`]),
	);
}

function schema() {
	const { fields } = foundry.data;

	return {
		rolls: new fields.ArrayField(
			new fields.StringField({
				required: true,
				nullable: false,
				choices: choiceLabels('rolls', REROLL_ROLLS),
			}),
			{
				required: true,
				nullable: false,
				initial: ['attack'],
				label: 'NIMBLE.rules.reroll.rolls.label',
				hint: 'NIMBLE.rules.reroll.rolls.hint',
			},
		),
		usedBy: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'roller',
			choices: choiceLabels('usedBy', REROLL_USERS),
			label: 'NIMBLE.rules.reroll.usedBy.label',
			hint: 'NIMBLE.rules.reroll.usedBy.hint',
		}),
		outcome: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'always',
			choices: choiceLabels('outcome', REROLL_OUTCOMES),
			label: 'NIMBLE.rules.reroll.outcome.label',
			hint: 'NIMBLE.rules.reroll.outcome.hint',
		}),
		attackDelivery: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'any',
			choices: choiceLabels('attackDelivery', REROLL_ATTACK_DELIVERIES),
			label: 'NIMBLE.rules.reroll.attackDelivery.label',
			hint: 'NIMBLE.rules.reroll.attackDelivery.hint',
		}),
		chargePoolIdentifier: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: '',
				label: 'NIMBLE.rules.reroll.chargePoolIdentifier.label',
				hint: 'NIMBLE.rules.reroll.chargePoolIdentifier.hint',
				widget: 'chargePoolPicker',
			}),
		),
		chargeCost: new fields.NumberField(
			withWidget({
				required: true,
				nullable: false,
				initial: 1,
				min: 1,
				integer: true,
				label: 'NIMBLE.rules.reroll.chargeCost.label',
				hint: 'NIMBLE.rules.reroll.chargeCost.hint',
				showWhen: (data: Record<string, unknown>) =>
					typeof data.chargePoolIdentifier === 'string' && data.chargePoolIdentifier.trim() !== '',
			}),
		),
		manaCost: new fields.NumberField({
			required: true,
			nullable: false,
			initial: 0,
			min: 0,
			integer: true,
			label: 'NIMBLE.rules.reroll.manaCost.label',
			hint: 'NIMBLE.rules.reroll.manaCost.hint',
		}),
		woundCost: new fields.NumberField({
			required: true,
			nullable: false,
			initial: 0,
			min: 0,
			integer: true,
			label: 'NIMBLE.rules.reroll.woundCost.label',
			hint: 'NIMBLE.rules.reroll.woundCost.hint',
		}),
		heroicReaction: new fields.StringField({
			required: true,
			nullable: false,
			blank: true,
			initial: '',
			choices: choiceLabels('heroicReaction', ['', ...HEROIC_REACTIONS]),
			label: 'NIMBLE.rules.reroll.heroicReaction.label',
			hint: 'NIMBLE.rules.reroll.heroicReaction.hint',
		}),
		rollModeChange: new fields.NumberField({
			required: true,
			nullable: false,
			initial: 0,
			min: -1,
			max: 1,
			integer: true,
			label: 'NIMBLE.rules.reroll.rollModeChange.label',
			hint: 'NIMBLE.rules.reroll.rollModeChange.hint',
		}),
		primaryDieBonus: new fields.NumberField({
			required: true,
			nullable: false,
			initial: 0,
			integer: true,
			label: 'NIMBLE.rules.reroll.primaryDieBonus.label',
			hint: 'NIMBLE.rules.reroll.primaryDieBonus.hint',
		}),
		extraDamage: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: '',
				label: 'NIMBLE.rules.reroll.extraDamage.label',
				hint: 'NIMBLE.rules.reroll.extraDamage.hint',
				widget: 'diceFormula',
			}),
		),
		automatic: new fields.BooleanField({
			required: true,
			nullable: false,
			initial: false,
			label: 'NIMBLE.rules.reroll.automatic.label',
			hint: 'NIMBLE.rules.reroll.automatic.hint',
		}),
		discardedCritTriggers: new fields.BooleanField(
			withWidget({
				required: true,
				nullable: false,
				initial: false,
				label: 'NIMBLE.rules.reroll.discardedCritTriggers.label',
				hint: 'NIMBLE.rules.reroll.discardedCritTriggers.hint',
				showWhen: (data: Record<string, unknown>) => CRIT_OUTCOMES.has(String(data.outcome)),
			}),
		),
		type: new fields.StringField({ required: true, nullable: false, initial: 'reroll' }),
	};
}

declare namespace RerollRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/** Which side of an attack is asking, and how the attack is delivered. */
interface RerollOfferContext {
	side: RerollUser;
	delivery: AttackDelivery;
}

/**
 * Lets the one who rolled, or the target, discard a roll and roll it again.
 * The second result stands. Read by the attack pipeline when a card is posted
 * and again on the GM client when the reroll is used, never during data
 * preparation.
 */
class RerollRule extends NimbleBaseRule<RerollRule.Schema> {
	static override group = 'triggers';
	static override description = 'NIMBLE.rules.reroll.description';

	declare rolls: RerollRoll[];
	declare usedBy: RerollUser;
	declare outcome: RerollTrigger;
	declare attackDelivery: RerollAttackDelivery;
	declare automatic: boolean;
	declare discardedCritTriggers: boolean;
	declare rollModeChange: number;
	declare primaryDieBonus: number;
	declare extraDamage: string;
	declare chargePoolIdentifier: string;
	declare chargeCost: number;
	declare manaCost: number;
	declare woundCost: number;
	declare heroicReaction: HeroicReactionKey | '';

	static override defineSchema(): RerollRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['rolls', 'string[]'],
				['usedBy', 'string'],
				['outcome', 'string'],
				['attackDelivery', 'string'],
				['automatic', 'boolean'],
				['discardedCritTriggers', 'boolean'],
				['rollModeChange', 'number'],
				['primaryDieBonus', 'number'],
				['extraDamage', 'string'],
				['chargePoolIdentifier', 'string'],
				['chargeCost', 'number'],
				['manaCost', 'number'],
				['woundCost', 'number'],
				['heroicReaction', 'string'],
			]),
		);
	}

	get rerollCost(): RerollCost {
		return {
			chargePoolIdentifier: this.chargePoolIdentifier ?? '',
			chargeCost: Math.max(1, Number(this.chargeCost) || 1),
			manaCost: Math.max(0, Number(this.manaCost) || 0),
			woundCost: Math.max(0, Number(this.woundCost) || 0),
			heroicReaction: this.heroicReaction ?? '',
		};
	}

	/**
	 * Whether this rule lets `context.side` reroll an attack delivered that
	 * way, now. The outcome is checked by the caller against the roll.
	 */
	offersRerollOn(context: RerollOfferContext): boolean {
		if (!this.item.isEmbedded) return false;
		if (!this.test()) return false;
		if (!this.rolls?.includes('attack')) return false;
		if (this.usedBy !== context.side) return false;
		if (!matchesAttackDelivery(this.attackDelivery, context.delivery)) return false;
		return canPayRerollCost(this.actor, this.rerollCost);
	}

	/** The changes this rule adds to the new roll. Extra damage reads this rule's actor. */
	rerollChanges(): RerollChanges {
		const formula = (this.extraDamage ?? '').trim();
		const extraDamage = formula
			? Roll.replaceFormulaData(formula, this.actor?.getRollData() ?? {}, { missing: '0' })
			: '';
		return {
			rollModeChange: Number(this.rollModeChange) || 0,
			primaryDieBonus: Number(this.primaryDieBonus) || 0,
			extraDamage,
		};
	}
}

export { RerollRule, type RerollOfferContext, type RerollUser };
