import type { OtherCreature } from '#types/otherCreature.d.ts';
import type { ResultCardView } from '#types/resultChange.d.ts';
import type { UseCost } from '#types/useCost.d.ts';
import type { Predicate } from '../../etc/Predicate.js';
import { ruleKey } from '../../utils/actor/actorRules.js';
import { canPayUseCost } from '../../utils/cost/useCost.js';
import {
	ATTACK_DELIVERY_FILTERS,
	ATTACK_SOURCES,
	type AttackDeliveryFilter,
	type AttackSourceFilter,
	matchesAttackDelivery,
	matchesAttackSource,
} from '../../utils/damage/attackDelivery.js';
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
import { ROLL_STATS, statsOfRoll } from '../../utils/reroll/rollStat.js';
import {
	type CheckRollKind,
	REROLL_ROLL_KINDS,
	type RollToReroll,
	type RollUseKind,
} from '../../utils/reroll/rollToReroll.js';
import { PredicateField } from '../fields/PredicateField.js';
import type { RuleFormGroup } from './_formLayout.js';
import { ruleOtherCreatureMatches } from './_otherCreatureMatches.js';
import { withWidget } from './_widgetOption.js';
import { NimbleBaseRule } from './base.js';

/** The lang namespace a rule's own words are under, as `NIMBLE.rules.<namespace>`. */
type RollUseNamespace = 'reroll' | 'changeDie' | 'makeCrit' | 'changeResult';

// Words that say what the rule does. The other words are the same for every
// rule that uses a roll, so they stay under the Reroll rule's keys.
const OWN_WORDS = new Set(['rolls.label', 'chargePoolIdentifier.hint', 'chargeCost.hint']);
const OWN_FIELDS = new Set(['oncePerRoll']);
// A crit use is only on attacks, and a roll that is a crit has no use for it.
const CRIT_WORDS = new Set(['usedBy.hint', 'outcome.label', 'outcome.hint']);
const CRIT_TRIGGERS = ['always', 'hit', 'miss'] as const;

function wordKey(namespace: RollUseNamespace, field: string, part: 'label' | 'hint'): string {
	const word = `${field}.${part}`;
	const own =
		OWN_FIELDS.has(field) ||
		OWN_WORDS.has(word) ||
		(namespace === 'makeCrit' && CRIT_WORDS.has(word));
	return `NIMBLE.rules.${own ? namespace : 'reroll'}.${field}.${part}`;
}

/** The lang keys of a field's choices, as `NIMBLE.rules.<namespace>.<field>.choices.<value>`. */
function choiceLabels(
	namespace: string,
	field: string,
	values: readonly string[],
): Record<string, string> {
	return Object.fromEntries(
		values.map((value) => [value, `NIMBLE.rules.${namespace}.${field}.choices.${value}`]),
	);
}

/** A rule with no roll field is used on attacks only. */
function rollsInclude(kind: RollUseKind) {
	return (data: Record<string, unknown>) =>
		Array.isArray(data.rolls) ? data.rolls.includes(kind) : kind === 'attack';
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
				choices: choiceLabels('reroll', 'rolls', REROLL_ROLL_KINDS),
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
				choices: choiceLabels('reroll', 'usedBy', REROLL_SIDES),
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

/** The attack outcome and delivery a rule can be used on, and the other creature. */
function whenFields(namespace: RollUseNamespace) {
	const { fields } = foundry.data;
	return {
		otherCreature: new PredicateField(
			withWidget({
				label: wordKey(namespace, 'otherCreature', 'label'),
				hint: wordKey(namespace, 'otherCreature', 'hint'),
				showWhen: forAttacks,
			}),
		),
		attackSource: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: 'any',
				choices: choiceLabels('attackOutcome', 'attackSource', ATTACK_SOURCES),
				label: wordKey(namespace, 'attackSource', 'label'),
				hint: wordKey(namespace, 'attackSource', 'hint'),
				showWhen: forAttacks,
			}),
		),
		thisItemOnly: new fields.BooleanField(
			withWidget({
				required: true,
				nullable: false,
				initial: false,
				label: wordKey(namespace, 'thisItemOnly', 'label'),
				hint: wordKey(namespace, 'thisItemOnly', 'hint'),
				showWhen: forAttacks,
			}),
		),
		outcome: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: 'always',
				choices: choiceLabels(
					'reroll',
					'outcome',
					namespace === 'makeCrit' ? CRIT_TRIGGERS : REROLL_TRIGGERS,
				),
				label: wordKey(namespace, 'outcome', 'label'),
				hint: wordKey(namespace, 'outcome', 'hint'),
				// A failed save or check counts for every rule but a crit use.
				...(namespace === 'makeCrit' ? { showWhen: forAttacks } : {}),
			}),
		),
		attackDelivery: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: 'any',
				choices: choiceLabels('reroll', 'attackDelivery', ATTACK_DELIVERY_FILTERS),
				label: wordKey(namespace, 'attackDelivery', 'label'),
				hint: wordKey(namespace, 'attackDelivery', 'hint'),
				showWhen: forAttacks,
			}),
		),
	};
}

/** Limits a rule to the rolls of one stat. Empty is any. */
function relatedFields() {
	const { fields } = foundry.data;
	return {
		relatedStat: new fields.StringField({
			required: true,
			nullable: false,
			blank: true,
			initial: '',
			choices: {
				'': 'NIMBLE.rules.reroll.relatedStat.choices.any',
				...Object.fromEntries(ROLL_STATS.map((stat) => [stat, `NIMBLE.abilityScores.${stat}`])),
			},
			label: 'NIMBLE.rules.reroll.relatedStat.label',
			hint: 'NIMBLE.rules.reroll.relatedStat.hint',
		}),
	};
}

/** What one use costs, and how often it can be used on one roll. */
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
		actionCost: new fields.NumberField({
			required: true,
			nullable: false,
			initial: 0,
			min: 0,
			max: 1,
			integer: true,
			choices: {
				0: 'NIMBLE.rules.reroll.actionCost.choices.none',
				1: 'NIMBLE.rules.reroll.actionCost.choices.one',
			},
			label: wordKey(namespace, 'actionCost', 'label'),
			hint: wordKey(namespace, 'actionCost', 'hint'),
		}),
		actionReportOnly: new fields.BooleanField(
			withWidget({
				required: true,
				nullable: false,
				initial: false,
				label: 'NIMBLE.rules.reroll.actionReportOnly.label',
				hint: 'NIMBLE.rules.reroll.actionReportOnly.hint',
				showWhen: (data: Record<string, unknown>) => Number(data.actionCost) > 0,
			}),
		),
		oncePerTurn: new fields.BooleanField({
			required: true,
			nullable: false,
			initial: false,
			label: 'NIMBLE.rules.reroll.oncePerTurn.label',
			hint: 'NIMBLE.rules.reroll.oncePerTurn.hint',
		}),
		oncePerRoll: new fields.BooleanField({
			required: true,
			nullable: false,
			initial: false,
			label: wordKey(namespace, 'oncePerRoll', 'label'),
			hint: wordKey(namespace, 'oncePerRoll', 'hint'),
		}),
	};
}

/** A short note under the feature on the card, and when it shows. */
function noteFields(namespace: RollUseNamespace) {
	const { fields } = foundry.data;
	return {
		cardHint: new fields.StringField({
			required: true,
			nullable: false,
			blank: true,
			initial: '',
			label: wordKey(namespace, 'cardHint', 'label'),
			hint: wordKey(namespace, 'cardHint', 'hint'),
		}),
		cardHintWhen: new PredicateField(
			withWidget({
				label: wordKey(namespace, 'cardHintWhen', 'label'),
				hint: wordKey(namespace, 'cardHintWhen', 'hint'),
				showWhen: (data: Record<string, unknown>) =>
					typeof data.cardHint === 'string' && data.cardHint.trim() !== '',
			}),
		),
	};
}

function rollUseFields(namespace: RollUseNamespace) {
	return {
		...rollFields(namespace),
		...whenFields(namespace),
		...costFields(namespace),
		...noteFields(namespace),
	};
}

declare namespace RollUseRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof rollUseFields>;
}

/**
 * Which side of the roll is asking, which roll it is, and the other creature:
 * the target for the one who rolled and an ally, the one who rolled for the
 * target. Null or absent when the roll has none.
 */
interface RollUseContext {
	side: RerollSide;
	roll: RollToReroll;
	other?: OtherCreature | null;
	/** A check card's result now. Absent when the entry is stamped. */
	card?: ResultCardView;
	/** The target this use is for, when the entry names one. */
	targetTokenUuid?: string | null;
}

const COST_FIELDS = [
	'chargePoolIdentifier',
	'chargeCost',
	'manaCost',
	'woundCost',
	'heroicReaction',
	'actionCost',
	'actionReportOnly',
	'oncePerTurn',
	'oncePerRoll',
] as const;

/**
 * A rule a creature uses on a roll after it is made: who can use it, on which
 * rolls, when, and what one use costs. Read when a card is posted and again
 * when the rule is used, never during data preparation.
 */
abstract class RollUseRule<
	TSchema extends NimbleBaseRule.Schema = RollUseRule.Schema,
> extends NimbleBaseRule<TSchema> {
	declare rolls: RollUseKind[];
	declare saves: string[];
	declare skills: string[];
	declare abilities: string[];
	declare relatedStat?: string;
	declare usedBy: RerollSide;
	declare reach: number;
	declare outcome: RerollTrigger;
	declare attackDelivery: AttackDeliveryFilter;
	declare attackSource: AttackSourceFilter;
	declare thisItemOnly: boolean;
	declare otherCreature: Predicate;
	declare chargePoolIdentifier: string;
	declare chargeCost: number;
	declare manaCost: number;
	declare woundCost: number;
	declare heroicReaction: HeroicReactionKey | '';
	declare actionCost: number;
	declare actionReportOnly: boolean;
	declare oncePerTurn: boolean;
	declare oncePerRoll: boolean;
	declare cardHint: string;
	declare cardHintWhen: Predicate;

	/**
	 * The fields every rule that uses a roll has, with the rule's own words, in
	 * four parts (roll, when, cost, note) so a rule can put its own fields between them.
	 * `related` is an extra part for the rules that can be limited to one stat.
	 */
	static rollUseSchemaParts(namespace: RollUseNamespace) {
		return {
			roll: rollFields(namespace),
			when: whenFields(namespace),
			cost: costFields(namespace),
			note: noteFields(namespace),
			related: relatedFields(),
		};
	}

	/** The form group of the note on the card, which goes last. */
	static noteFormGroup(): RuleFormGroup {
		return { fields: ['cardHint', 'cardHintWhen'] };
	}

	/** The form group of the fields that pick the rolls, with `extra` fields of the rule. */
	static rollFormGroup(extra: readonly string[] = []): RuleFormGroup {
		return { fields: ['rolls', 'saves', 'skills', 'abilities', ...extra] };
	}

	/** The form groups of who, when, only while and cost, with `between` after who. */
	static useFormGroups(between: readonly RuleFormGroup[] = []): RuleFormGroup[] {
		return [
			{ fields: ['usedBy', 'reach'] },
			...between,
			{
				label: 'NIMBLE.rules.reroll.form.when',
				fields: ['outcome', 'attackDelivery', 'attackSource', 'thisItemOnly'],
			},
			{
				label: 'NIMBLE.rules.reroll.form.onlyWhile.label',
				hint: 'NIMBLE.rules.reroll.form.onlyWhile.hint',
				fields: ['predicate'],
			},
			{ fields: ['otherCreature'] },
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
			['attackSource', 'string'],
			['thisItemOnly', 'boolean'],
			['otherCreature', 'object'],
			['chargePoolIdentifier', 'string'],
			['chargeCost', 'number'],
			['manaCost', 'number'],
			['woundCost', 'number'],
			['heroicReaction', 'string'],
			['actionCost', 'number'],
			['actionReportOnly', 'boolean'],
			['oncePerTurn', 'boolean'],
			['oncePerRoll', 'boolean'],
			['reach', 'number'],
			['cardHint', 'string'],
			['cardHintWhen', 'object'],
		];
	}

	get rollUseCost(): UseCost {
		return {
			chargePoolIdentifier: this.chargePoolIdentifier ?? '',
			chargeCost: Math.max(1, Number(this.chargeCost) || 1),
			manaCost: Math.max(0, Number(this.manaCost) || 0),
			woundCost: Math.max(0, Number(this.woundCost) || 0),
			heroicReaction: this.heroicReaction ?? '',
			actionCost: Math.min(1, Math.max(0, Math.trunc(Number(this.actionCost) || 0))),
			...(this.actionReportOnly ? { actionReportOnly: true } : {}),
			...(this.oncePerTurn ? { turnUseKey: ruleKey(this) } : {}),
		};
	}

	/**
	 * Whether this rule lets `context.side` use it on this roll now. The outcome
	 * of an attack is checked by the caller against the roll.
	 */
	offersUseOn(context: RollUseContext): boolean {
		if (!this.coversRoll(context)) return false;
		if (context.roll.kind !== 'attack' && context.card?.result === 'succeeded') {
			if (this.waitsForFailure()) return false;
		}
		return canPayUseCost(this.actor, this.rollUseCost);
	}

	/** Whether this rule's limits cover this roll and side. Not its cost, and not the card. */
	protected coversRoll(context: RollUseContext): boolean {
		if (!this.isOnActor) return false;
		if (!this.test()) return false;
		const { side, roll } = context;
		if (!this.usesOnRolls().includes(roll.kind)) return false;
		if (this.usedBy !== side) return false;
		if (!ruleOtherCreatureMatches(this, this.otherCreature, context.other)) return false;
		if (roll.kind === 'attack') {
			if (!matchesAttackDelivery(this.attackDelivery, roll.delivery)) return false;
			if (this.thisItemOnly && roll.itemUuid !== this.item?.uuid) return false;
			if ((this.attackSource ?? 'any') !== 'any') {
				const item = roll.itemUuid ? fromUuidSync(roll.itemUuid) : null;
				if (!matchesAttackSource(this.attackSource, item as { type?: string } | null)) return false;
			}
		} else {
			// A check has no target side.
			if (side === 'target') return false;
			const keys = this.checkKeys(roll.kind);
			if (keys.length > 0 && !keys.includes(roll.key)) return false;
		}
		const stat = this.relatedStat ?? '';
		return !stat || statsOfRoll(roll).includes(stat);
	}

	/** Whether a card that says Succeeded takes this rule's row away. */
	protected waitsForFailure(): boolean {
		return this.outcome === 'failed';
	}

	/** The kinds of roll this rule can be used on. */
	protected usesOnRolls(): readonly RollUseKind[] {
		return this.rolls ?? [];
	}

	/** The note this rule puts under its feature on the card for this roll. Empty for none. */
	cardHintFor(context: RollUseContext): string {
		const note = (this.cardHint ?? '').trim();
		if (!note) return '';
		return ruleOtherCreatureMatches(this, this.cardHintWhen, context.other) ? note : '';
	}

	private checkKeys(kind: CheckRollKind): string[] {
		if (kind === 'initiative') return [];
		const keys = { save: this.saves, skillCheck: this.skills, abilityCheck: this.abilities }[kind];
		return Array.isArray(keys) ? keys : [];
	}
}

export { choiceLabels, RollUseRule, type RollUseContext };
