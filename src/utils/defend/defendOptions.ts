import { ruleOtherCreatureMatches } from '../../models/rules/_otherCreatureMatches.js';
import type { DefendOptionRule, DefendOptionWay } from '../../models/rules/defendOption.js';
import { actorRules, ruleKey, ruleLabel } from '../actor/actorRules.js';
import { payCost } from '../cost/costLedger.js';
import { attackDeliveryFromAttackType, matchesAttackDelivery } from '../damage/attackDelivery.js';
import type { IncomingReactionEntry } from '../incomingReactions/incomingReactionEntry.js';
import localize from '../localize.js';
import { canPayRerollCost, type RerollCost } from '../reroll/rerollCost.js';
import { type DefendCardLike, speakerActorOf } from './defendReactors.js';
import type { AttackerCondition, DefendOptionUse, DefendOutcome } from './defendRecords.js';

const RULE_TYPE = 'defendOption';

/** A Defend option one hero can use against one attack card. */
export interface DefendOptionPick {
	key: string;
	label: string;
	rule: DefendOptionRule;
}

/** What the picked Defend options do together to the Defended hero's damage. */
export interface DefendOptionEffect {
	outcome: DefendOutcome;
	armorBonus: number;
	reminders: string[];
	attackerConditions: AttackerCondition[];
	wholeRound: boolean;
}

function cardDelivery(card: DefendCardLike) {
	const attackType = (card.system as { activation?: { targets?: { attackType?: string } } } | null)
		?.activation?.targets?.attackType;
	return attackDeliveryFromAttackType(attackType);
}

/** The enabled Defend options of a way that fit this attack. Costs the hero cannot pay are left out. */
export function defendOptionsOf(
	actor: Actor.Implementation | null | undefined,
	card: DefendCardLike,
	way: DefendOptionWay,
): DefendOptionPick[] {
	const delivery = cardDelivery(card);
	const attacker = speakerActorOf(card);
	return actorRules<DefendOptionRule>(actor as { rules?: unknown } | null)
		.filter(
			(rule) =>
				rule.type === RULE_TYPE &&
				rule.way === way &&
				rule.appliesTo() &&
				matchesAttackDelivery(rule.attackDelivery, delivery) &&
				ruleOtherCreatureMatches(rule, rule.otherCreature, attacker) &&
				(rule.useItem || canPayRerollCost(actor, tickCost(rule, card))),
		)
		.map((rule) => ({ key: ruleKey(rule), label: ruleLabel(rule), rule }));
}

/** Each condition once; it ends on the attacker's turn when one of its options says so. */
function attackerConditionsOf(rules: readonly DefendOptionRule[]): AttackerCondition[] {
	const endsOnTurn = new Map<string, boolean>();
	for (const rule of rules) {
		if (!rule.attackerCondition) continue;
		const ends = rule.attackerConditionEnds === 'attackerTurn';
		endsOnTurn.set(
			rule.attackerCondition,
			(endsOnTurn.get(rule.attackerCondition) ?? false) || ends,
		);
	}
	return [...endsOnTurn].map(([condition, endsOnAttackerTurn]) => ({
		condition,
		endsOnAttackerTurn,
	}));
}

const OUTCOME_ORDER: readonly DefendOutcome[] = ['miss', 'noDamage', 'halve', 'none'];

/**
 * The options in the fixed order: the attack misses or no damage, then halve or
 * armor, then the rest.
 */
export function defendOptionEffect(rules: readonly DefendOptionRule[]): DefendOptionEffect {
	const outcome =
		OUTCOME_ORDER.find((each) => rules.some((rule) => rule.outcome === each)) ?? 'none';
	return {
		outcome,
		armorBonus: rules.reduce((sum, rule) => sum + rule.resolveArmorBonus(), 0),
		reminders: rules.flatMap((rule) => {
			const text = (rule.reminder ?? '').trim();
			return text ? [`${ruleLabel(rule)}: ${text}`] : [];
		}),
		attackerConditions: attackerConditionsOf(rules),
		wholeRound: rules.some((rule) => rule.wholeRound),
	};
}

/** The unused card reroll of an item for a token, which a Defend option can use. */
export function cardRerollFor(
	card: DefendCardLike,
	itemUuid: string | null | undefined,
	tokenUuid: string | null | undefined,
): IncomingReactionEntry | null {
	if (!itemUuid) return null;
	const entries =
		(card.system as { incomingReactions?: IncomingReactionEntry[] } | null)?.incomingReactions ??
		[];
	return (
		entries.find(
			(entry) =>
				entry.kind === 'reroll' &&
				!entry.used &&
				entry.itemUuid === itemUuid &&
				(!entry.targetTokenUuid || !tokenUuid || entry.targetTokenUuid === tokenUuid),
		) ?? null
	);
}

interface ItemRerollRule {
	type?: string;
	id?: string;
	disabled?: boolean;
	rolls?: string[];
	rollUseCost?: RerollCost;
}

/**
 * What one use of the option costs. A "When you Defend" tick that rerolls is
 * paid by its item's Reroll rule, not by the option: the rule of the card's
 * entry, else the item's Reroll rule for attacks.
 */
export function tickCost(
	rule: DefendOptionRule,
	card?: DefendCardLike | null,
	tokenUuid?: string | null,
): RerollCost {
	if (rule.way !== 'withDefend' || !rule.useReroll) return rule.optionCost;
	const rules = (rule.item as { rules?: Map<string, ItemRerollRule> } | null)?.rules;
	const rerolls = [...(rules?.values() ?? [])].filter(
		(each) => each.type === 'reroll' && !each.disabled,
	);
	const entryRuleId = card ? cardRerollFor(card, rule.item?.uuid, tokenUuid)?.ruleId : undefined;
	const reroll =
		rerolls.find((each) => entryRuleId && each.id === entryRuleId) ??
		rerolls.find((each) => each.rolls?.includes('attack'));
	return reroll?.rollUseCost ?? rule.optionCost;
}

/** Whether a Defend option uses this item's reroll, so the reroll waits for the Defend window. */
export function rerollIsUsedByDefend(itemUuid: string | null | undefined): boolean {
	if (!itemUuid) return false;
	const item = fromUuidSync(itemUuid as `Item.${string}`) as {
		rules?: Map<string, DefendOptionRule>;
	} | null;
	return [...(item?.rules?.values() ?? [])].some(
		(rule) => rule.type === RULE_TYPE && rule.useReroll && !rule.disabled,
	);
}

/** Pay a Defend option's cost. Null, with a warning, when it cannot be paid. */
export async function payDefendOption(
	actor: Actor.Implementation,
	pick: DefendOptionPick,
): Promise<DefendOptionUse | null> {
	const cost = pick.rule.optionCost;
	const paid = await payCost(actor, cost);
	if (!paid) {
		ui.notifications?.warn(localize('NIMBLE.chat.defend.cannotPay', { label: pick.label }));
		return null;
	}
	return {
		actorUuid: actor.uuid ?? '',
		ruleId: pick.rule.id ?? '',
		itemUuid: pick.rule.item?.uuid ?? '',
		label: pick.label,
		cost,
		paid,
	};
}

/** A Defend option used with nothing paid. */
export function defendOptionUse(
	actor: Actor.Implementation,
	pick: DefendOptionPick,
): DefendOptionUse {
	return {
		actorUuid: actor.uuid ?? '',
		ruleId: pick.rule.id ?? '',
		itemUuid: pick.rule.item?.uuid ?? '',
		label: pick.label,
		cost: null,
		paid: null,
	};
}
