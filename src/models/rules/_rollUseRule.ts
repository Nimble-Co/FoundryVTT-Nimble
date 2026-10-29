import { matchesAttackDelivery } from '../../utils/damage/attackDelivery.js';
import {
	getHeroicReactionLabelKey,
	HEROIC_REACTIONS,
	type HeroicReactionKey,
} from '../../utils/incomingReactions/heroicActions.js';
import {
	REROLL_SIDES,
	REROLL_TRIGGERS,
	type RerollSide,
	type RerollTrigger,
} from '../../utils/incomingReactions/incomingReactionEntry.js';
import { canPayRerollCost, type RerollCost } from '../../utils/reroll/rerollCost.js';
import {
	type CheckRollKind,
	REROLL_ROLL_KINDS,
	type RerollRollKind,
	type RollToReroll,
} from '../../utils/reroll/rollToReroll.js';
import type { RuleFormGroup } from './_formLayout.js';
import { withWidget } from './_widgetOption.js';
import { NimbleBaseRule } from './base.js';

const ROLL_USE_ATTACK_DELIVERIES = ['any', 'melee', 'ranged'] as const;

type RollUseAttackDelivery = (typeof ROLL_USE_ATTACK_DELIVERIES)[number];

/** The lang namespace a rule's own words are under, as `NIMBLE.rules.<namespace>`. */
type RollUseNamespace = 'reroll';

// Words that say what the rule does. The other words are the same for every
// rule that uses a roll, so they stay under the Reroll rule's keys.
const OWN_WORDS = new Set(['rolls.label', 'chargePoolIdentifier.hint', 'chargeCost.hint']);
const OWN_FIELDS = new Set(['oncePerAttack']);

function wordKey(namespace: RollUseNamespace, field: string, part: 'label' | 'hint'): string {
	const own = OWN_FIELDS.has(field) || OWN_WORDS.has(`${field}.${part}`);
	return `NIMBLE.rules.${own ? namespace : 'reroll'}.${field}.${part}`;
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

/** The save, skill or ability keys a rule is limited to. Empty is any. */
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

/** Which roll, who, when: the fields that pick the rolls a rule can be used on. */
function rollFields(namespace: RollUseNamespace) {
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
				label: wordKey(namespace, 'rolls', 'label'),
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
				label: wordKey(namespace, 'usedBy', 'label'),
				hint: wordKey(namespace, 'usedBy', 'hint'),
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
				label: wordKey(namespace, 'reach', 'label'),
				hint: wordKey(namespace, 'reach', 'hint'),
				showWhen: (data: Record<string, unknown>) => data.usedBy === 'ally',
			}),
		),
	};
}

/** The attack outcome and delivery a rule can be used on. */
function whenFields(namespace: RollUseNamespace) {
	const { fields } = foundry.data;
	return {
		outcome: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: 'always',
				choices: choiceLabels('outcome', REROLL_TRIGGERS),
				label: wordKey(namespace, 'outcome', 'label'),
				hint: wordKey(namespace, 'outcome', 'hint'),
				showWhen: forAttacks,
			}),
		),
		attackDelivery: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: 'any',
				choices: choiceLabels('attackDelivery', ROLL_USE_ATTACK_DELIVERIES),
				label: wordKey(namespace, 'attackDelivery', 'label'),
				hint: wordKey(namespace, 'attackDelivery', 'hint'),
				showWhen: forAttacks,
			}),
		),
	};
}

/** What one use costs, and how often it can be used on one attack. */
function costFields(namespace: RollUseNamespace) {
	const { fields } = foundry.data;
	return {
		chargePoolIdentifier: new fields.StringField(
			withWidget({
				// Not required, so the picker lists an empty choice for no pool.
				required: false,
				nullable: false,
				initial: '',
				label: wordKey(namespace, 'chargePoolIdentifier', 'label'),
				hint: wordKey(namespace, 'chargePoolIdentifier', 'hint'),
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
				label: wordKey(namespace, 'chargeCost', 'label'),
				hint: wordKey(namespace, 'chargeCost', 'hint'),
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
			label: wordKey(namespace, 'manaCost', 'label'),
			hint: wordKey(namespace, 'manaCost', 'hint'),
		}),
		woundCost: new fields.NumberField({
			required: true,
			nullable: false,
			initial: 0,
			min: 0,
			integer: true,
			label: wordKey(namespace, 'woundCost', 'label'),
			hint: wordKey(namespace, 'woundCost', 'hint'),
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
			label: wordKey(namespace, 'heroicReaction', 'label'),
			hint: wordKey(namespace, 'heroicReaction', 'hint'),
		}),
		oncePerAttack: new fields.BooleanField(
			withWidget({
				required: true,
				nullable: false,
				initial: false,
				label: wordKey(namespace, 'oncePerAttack', 'label'),
				hint: wordKey(namespace, 'oncePerAttack', 'hint'),
				showWhen: forAttacks,
			}),
		),
	};
}

function rollUseSchema(namespace: RollUseNamespace) {
	return { ...rollFields(namespace), ...whenFields(namespace), ...costFields(namespace) };
}

declare namespace RollUseRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof rollUseSchema>;
}

/** Which side of the roll is asking, and which roll it is. */
interface RollUseContext {
	side: RerollSide;
	roll: RollToReroll;
}

const COST_FIELDS = [
	'chargePoolIdentifier',
	'chargeCost',
	'manaCost',
	'woundCost',
	'heroicReaction',
	'oncePerAttack',
] as const;

/**
 * A rule a creature uses on a roll after it is made: who can use it, on which
 * rolls, when, and what one use costs. Read when a card is posted and again
 * when the rule is used, never during data preparation.
 */
abstract class RollUseRule<
	TSchema extends RollUseRule.Schema = RollUseRule.Schema,
> extends NimbleBaseRule<TSchema> {
	declare rolls: RerollRollKind[];
	declare saves: string[];
	declare skills: string[];
	declare abilities: string[];
	declare usedBy: RerollSide;
	declare reach: number;
	declare outcome: RerollTrigger;
	declare attackDelivery: RollUseAttackDelivery;
	declare chargePoolIdentifier: string;
	declare chargeCost: number;
	declare manaCost: number;
	declare woundCost: number;
	declare heroicReaction: HeroicReactionKey | '';
	declare oncePerAttack: boolean;

	/**
	 * The fields every rule that uses a roll has, with the rule's own words, in
	 * three parts so a rule can put its own fields between them.
	 */
	static rollUseSchema(namespace: RollUseNamespace) {
		return {
			roll: rollFields(namespace),
			when: whenFields(namespace),
			cost: costFields(namespace),
		};
	}

	/** The form groups of the fields that pick the rolls. */
	static rollFormGroup(): RuleFormGroup {
		return { fields: ['rolls', 'saves', 'skills', 'abilities'] };
	}

	/** The form groups of who, when, only while and cost, with `between` after who. */
	static useFormGroups(between: readonly RuleFormGroup[] = []): RuleFormGroup[] {
		return [
			{ fields: ['usedBy', 'reach'] },
			...between,
			{ label: 'NIMBLE.rules.reroll.form.when', fields: ['outcome', 'attackDelivery'] },
			{
				label: 'NIMBLE.rules.reroll.form.onlyWhile.label',
				hint: 'NIMBLE.rules.reroll.form.onlyWhile.hint',
				fields: ['predicate'],
			},
			{
				label: 'NIMBLE.rules.reroll.form.cost.label',
				hint: 'NIMBLE.rules.reroll.form.cost.hint',
				fields: COST_FIELDS,
			},
		];
	}

	/** The tooltip types of the shared fields. */
	static rollUseTooltipTypes(): Array<[string, string]> {
		return [
			['rolls', 'string[]'],
			['saves', 'string[]'],
			['skills', 'string[]'],
			['abilities', 'string[]'],
			['usedBy', 'string'],
			['outcome', 'string'],
			['attackDelivery', 'string'],
			['chargePoolIdentifier', 'string'],
			['chargeCost', 'number'],
			['manaCost', 'number'],
			['woundCost', 'number'],
			['heroicReaction', 'string'],
			['oncePerAttack', 'boolean'],
			['reach', 'number'],
		];
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
	 * Whether this rule lets `context.side` use it on this roll now. The outcome
	 * of an attack is checked by the caller against the roll.
	 */
	offersRerollOn(context: RollUseContext): boolean {
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
}

export { RollUseRule, type RollUseContext };
