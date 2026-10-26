import { matchesAttackDelivery } from '../../utils/attackDelivery.js';
import {
	getHeroicReactionLabelKey,
	HEROIC_REACTIONS,
	type HeroicReactionKey,
} from '../../utils/heroicActions.js';
import {
	REROLL_DICE,
	REROLL_KEEPS,
	REROLL_SIDES,
	REROLL_TRIGGERS,
	type RerollDie,
	type RerollKeep,
	type RerollSide,
	type RerollTrigger,
} from '../../utils/incomingReactionEntry.js';
import { canPayRerollCost, type RerollCost } from '../../utils/rerollCost.js';
import type { RerollChanges } from '../../utils/rerollOptions.js';
import {
	type CheckRollKind,
	REROLL_ROLL_KINDS,
	type RerollRollKind,
	type RollToReroll,
} from '../../utils/rollToReroll.js';
import type { RuleFormGroup } from './_formLayout.js';
import { withWidget } from './_widgetOption.js';
import { NimbleBaseRule } from './base.js';

const REROLL_ATTACK_DELIVERIES = ['any', 'melee', 'ranged'] as const;

// Outcomes whose first roll can be a crit.
const CRIT_OUTCOMES = new Set(['always', 'hit', 'criticalHit']);

type RerollAttackDelivery = (typeof REROLL_ATTACK_DELIVERIES)[number];

// A reroll that needs a choice from someone can never happen by itself.
function nobodyChooses(data: Record<string, unknown>): boolean {
	return data.usedBy !== 'ally' && data.die !== 'pickedDie' && (data.keep ?? 'new') === 'new';
}

function choiceLabels(field: string, values: readonly string[]): Record<string, string> {
	return Object.fromEntries(
		values.map((value) => [value, `NIMBLE.rules.reroll.${field}.choices.${value}`]),
	);
}

function rollsInclude(kind: RerollRollKind) {
	return (data: Record<string, unknown>) => Array.isArray(data.rolls) && data.rolls.includes(kind);
}

const forAttacks = rollsInclude('attack');

// Roll changes apply to a new roll of the whole formula only.
const wholeRoll = (data: Record<string, unknown>) => (data.die ?? 'wholeRoll') === 'wholeRoll';
const forWholeAttackRolls = (data: Record<string, unknown>) => forAttacks(data) && wholeRoll(data);

/** The save, skill or ability keys a check reroll is limited to. Empty is any. */
function checkKeysField(
	name: 'saves' | 'skills' | 'abilities',
	kind: CheckRollKind,
	choices: () => Record<string, string>,
) {
	const { fields } = foundry.data;
	return new fields.ArrayField(
		new fields.StringField({ required: true, nullable: false, choices }),
		withWidget({
			required: true,
			nullable: false,
			initial: [] as string[],
			label: `NIMBLE.rules.reroll.${name}.label`,
			hint: 'NIMBLE.rules.reroll.noneMeansAny',
			showWhen: rollsInclude(kind),
		}),
	);
}

function schema() {
	const { fields } = foundry.data;

	return {
		rolls: new fields.ArrayField(
			new fields.StringField({
				required: true,
				nullable: false,
				choices: choiceLabels('rolls', REROLL_ROLL_KINDS),
			}),
			{
				required: true,
				nullable: false,
				initial: ['attack'],
				label: 'NIMBLE.rules.reroll.rolls.label',
			},
		),
		saves: checkKeysField('saves', 'save', () => CONFIG.NIMBLE.savingThrows),
		skills: checkKeysField('skills', 'skillCheck', () => CONFIG.NIMBLE.skills),
		abilities: checkKeysField('abilities', 'abilityCheck', () => CONFIG.NIMBLE.abilityScores),
		usedBy: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: 'roller',
				choices: choiceLabels('usedBy', REROLL_SIDES),
				label: 'NIMBLE.rules.reroll.usedBy.label',
				hint: 'NIMBLE.rules.reroll.usedBy.hint',
				widget: 'chips',
			}),
		),
		reach: new fields.NumberField(
			withWidget({
				required: true,
				nullable: false,
				initial: 0,
				min: 0,
				integer: true,
				label: 'NIMBLE.rules.reroll.reach.label',
				hint: 'NIMBLE.rules.reroll.reach.hint',
				showWhen: (data: Record<string, unknown>) => data.usedBy === 'ally',
			}),
		),
		die: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'wholeRoll',
			choices: choiceLabels('die', REROLL_DICE),
			label: 'NIMBLE.rules.reroll.die.label',
			hint: 'NIMBLE.rules.reroll.die.hint',
		}),
		keep: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'new',
			choices: choiceLabels('keep', REROLL_KEEPS),
			label: 'NIMBLE.rules.reroll.keep.label',
			hint: 'NIMBLE.rules.reroll.keep.hint',
		}),
		outcome: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: 'always',
				choices: choiceLabels('outcome', REROLL_TRIGGERS),
				label: 'NIMBLE.rules.reroll.outcome.label',
				hint: 'NIMBLE.rules.reroll.outcome.hint',
				showWhen: forAttacks,
			}),
		),
		attackDelivery: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: 'any',
				choices: choiceLabels('attackDelivery', REROLL_ATTACK_DELIVERIES),
				label: 'NIMBLE.rules.reroll.attackDelivery.label',
				hint: 'NIMBLE.rules.reroll.attackDelivery.hint',
				showWhen: forAttacks,
			}),
		),
		chargePoolIdentifier: new fields.StringField(
			withWidget({
				// Not required, so the picker lists an empty choice for no pool.
				required: false,
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
			choices: {
				'': 'NIMBLE.rules.reroll.heroicReaction.choices.none',
				...Object.fromEntries(HEROIC_REACTIONS.map((key) => [key, getHeroicReactionLabelKey(key)])),
			} as Record<HeroicReactionKey | '', string>,
			label: 'NIMBLE.rules.reroll.heroicReaction.label',
			hint: 'NIMBLE.rules.reroll.heroicReaction.hint',
		}),
		oncePerAttack: new fields.BooleanField(
			withWidget({
				required: true,
				nullable: false,
				initial: false,
				label: 'NIMBLE.rules.reroll.oncePerAttack.label',
				hint: 'NIMBLE.rules.reroll.oncePerAttack.hint',
				showWhen: forAttacks,
			}),
		),
		rollModeChange: new fields.NumberField(
			withWidget({
				required: true,
				nullable: false,
				initial: 0,
				min: -1,
				max: 1,
				integer: true,
				choices: {
					0: 'NIMBLE.rules.reroll.rollModeChange.choices.none',
					1: 'NIMBLE.rules.reroll.rollModeChange.choices.advantage',
					[-1]: 'NIMBLE.rules.reroll.rollModeChange.choices.disadvantage',
				},
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
		type: new fields.StringField({ required: true, nullable: false, initial: 'reroll' }),
	};
}

declare namespace RerollRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/** Which side of the roll is asking, and which roll it is. */
interface RerollOfferContext {
	side: RerollSide;
	roll: RollToReroll;
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
	static override formLayout: readonly RuleFormGroup[] = [
		{ fields: ['rolls', 'saves', 'skills', 'abilities'] },
		{ fields: ['usedBy', 'reach'] },
		{ fields: ['die', 'keep'] },
		{ label: 'NIMBLE.rules.reroll.form.when', fields: ['outcome', 'attackDelivery'] },
		{
			label: 'NIMBLE.rules.reroll.form.onlyWhile.label',
			hint: 'NIMBLE.rules.reroll.form.onlyWhile.hint',
			fields: ['predicate'],
		},
		{
			label: 'NIMBLE.rules.reroll.form.cost.label',
			hint: 'NIMBLE.rules.reroll.form.cost.hint',
			fields: [
				'chargePoolIdentifier',
				'chargeCost',
				'manaCost',
				'woundCost',
				'heroicReaction',
				'oncePerAttack',
			],
		},
		{
			label: 'NIMBLE.rules.reroll.form.changes.label',
			hint: 'NIMBLE.rules.reroll.form.changes.hint',
			fields: ['rollModeChange', 'primaryDieBonus', 'extraDamage'],
		},
		{ fields: ['automatic', 'discardedCritTriggers'] },
	];

	declare rolls: RerollRollKind[];
	declare saves: string[];
	declare skills: string[];
	declare abilities: string[];
	declare usedBy: RerollSide;
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
	declare oncePerAttack: boolean;
	declare reach: number;
	declare die: RerollDie;
	declare keep: RerollKeep;

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
				['saves', 'string[]'],
				['skills', 'string[]'],
				['abilities', 'string[]'],
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
				['oncePerAttack', 'boolean'],
				['reach', 'number'],
				['die', 'string'],
				['keep', 'string'],
			]),
		);
	}

	/** Whether the rule rerolls with no button. Never when someone has a choice to make. */
	get rerollsByItself(): boolean {
		return this.automatic === true && nobodyChooses(this as unknown as Record<string, unknown>);
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
	 * Whether this rule lets `context.side` reroll this roll now. The outcome
	 * of an attack is checked by the caller against the roll.
	 */
	offersRerollOn(context: RerollOfferContext): boolean {
		if (!this.item.isEmbedded) return false;
		if (!this.test()) return false;
		const { side, roll } = context;
		if (!this.rolls?.includes(roll.kind)) return false;
		if (this.usedBy !== side) return false;
		if (roll.kind === 'attack') {
			if (!matchesAttackDelivery(this.attackDelivery, roll.delivery)) return false;
		} else {
			// A check has no target side.
			if (side === 'target') return false;
			const keys = this.checkKeys(roll.kind);
			if (keys.length > 0 && !keys.includes(roll.key)) return false;
		}
		return canPayRerollCost(this.actor, this.rerollCost);
	}

	private checkKeys(kind: CheckRollKind): string[] {
		const keys = { save: this.saves, skillCheck: this.skills, abilityCheck: this.abilities }[kind];
		return Array.isArray(keys) ? keys : [];
	}

	/**
	 * The changes this rule adds to the new roll. Extra damage reads this
	 * rule's actor. Only an attack gets the attack changes.
	 */
	rerollChanges(kind: RerollRollKind): RerollChanges {
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

export { RerollRule, type RerollOfferContext };
