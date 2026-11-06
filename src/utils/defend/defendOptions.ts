import type { OtherCreature } from '#types/otherCreature.d.ts';
import { ruleOtherCreatureMatches } from '../../models/rules/_otherCreatureMatches.js';
import type { DefendOptionRule, DefendOptionWay } from '../../models/rules/defendOption.js';
import { actorRules, ruleKey, ruleLabel } from '../actor/actorRules.js';
import { attackDeliveryFromAttackType, matchesAttackDelivery } from '../damage/attackDelivery.js';
import type { IncomingReactionEntry } from '../incomingReactions/incomingReactionEntry.js';
import localize from '../localize.js';
import { canPayRerollCost, payRerollCost } from '../reroll/rerollCost.js';
import { type DefendCardLike, speakerActorOf } from './defendReactors.js';
import type { DefendOptionUse, DefendOutcome } from './defendRecords.js';

const RULE_TYPE = 'defendOption';

interface AttackCardLike {
	system?: unknown;
	speaker?: DefendCardLike['speaker'];
}

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
	attackerConditions: string[];
	wholeRound: boolean;
}

function cardDelivery(card: AttackCardLike) {
	const attackType = (card.system as { activation?: { targets?: { attackType?: string } } } | null)
		?.activation?.targets?.attackType;
	return attackDeliveryFromAttackType(attackType);
}

/** The enabled Defend options of a way that fit this attack. Costs the hero cannot pay are left out. */
export function defendOptionsOf(
	actor: Actor.Implementation | null | undefined,
	card: AttackCardLike,
	way: DefendOptionWay,
): DefendOptionPick[] {
	const delivery = cardDelivery(card);
	const attacker = speakerActorOf({
		system: card.system,
		speaker: card.speaker,
	}) as OtherCreature | null;
	return actorRules<DefendOptionRule>(actor as { rules?: unknown } | null)
		.filter(
			(rule) =>
				rule.type === RULE_TYPE &&
				rule.way === way &&
				rule.appliesTo() &&
				matchesAttackDelivery(rule.attackDelivery, delivery) &&
				ruleOtherCreatureMatches(rule, rule.otherCreature, attacker) &&
				(rule.useItem || canPayRerollCost(actor, rule.optionCost)),
		)
		.map((rule) => ({ key: ruleKey(rule), label: ruleLabel(rule), rule }));
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
		attackerConditions: [
			...new Set(rules.map((rule) => rule.attackerCondition).filter((id) => !!id)),
		],
		wholeRound: rules.some((rule) => rule.wholeRound),
	};
}

/** The unused card reroll of an item for a token, which a Defend option can use. */
export function cardRerollFor(
	card: AttackCardLike,
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
	const paid = await payRerollCost(actor, cost);
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
