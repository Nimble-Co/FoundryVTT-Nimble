import type {
	AttackerEffect,
	DefendCardLike,
	DefendOptionPick,
	DefendOptionUse,
	DefendOutcome,
} from '#types/defend.d.ts';
import type { UseCost } from '#types/useCost.d.ts';
import { ruleOtherCreatureMatches } from '../../models/rules/_otherCreatureMatches.js';
import type { DefendOptionRule, DefendOptionWay } from '../../models/rules/defendOption.js';
import { actorRules, ruleKey, ruleLabel, runningRuleParent } from '../actor/actorRules.js';
import { itemEffectOf } from '../actor/itemEffectOf.js';
import { payCost } from '../cost/costLedger.js';
import { canPayUseCost } from '../cost/useCost.js';
import { attackDeliveryFromAttackType, matchesAttackDelivery } from '../damage/attackDelivery.js';
import type { IncomingReactionEntry } from '../incomingReactions/incomingReactionEntry.js';
import localize from '../localize.js';
import { speakerActorOf } from './defendReactors.js';

const RULE_TYPE = 'defendOption';

/** What the picked Defend options do together to the Defended hero's damage. */
interface DefendOptionEffect {
	outcome: DefendOutcome;
	armorBonus: number;
	reminders: string[];
	attackerEffects: AttackerEffect[];
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
				(rule.useItem || canPayUseCost(actor, tickCost(rule, card))),
		)
		.map((rule) => ({ key: ruleKey(rule), label: ruleLabel(rule), rule }));
}

interface ItemWithEffects {
	uuid?: string | null;
	effects?: { get(id: string): { name?: string | null; transfer?: boolean } | undefined } | null;
}

/** The item effect of each option that names one, each effect once. A missing effect is left out. */
function attackerEffectsOf(rules: readonly DefendOptionRule[]): AttackerEffect[] {
	const effects = new Map<string, AttackerEffect>();
	for (const rule of rules) {
		const item = rule.parentDocument as ItemWithEffects | null;
		const effect = itemEffectOf(item, rule.attackerEffectId);
		if (!effect || !item?.uuid) continue;
		const key = `${item.uuid}:${rule.attackerEffectId}`;
		if (effects.has(key)) continue;
		effects.set(key, {
			itemUuid: item.uuid,
			effectId: rule.attackerEffectId,
			name: effect.name ?? '',
		});
	}
	return [...effects.values()];
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
		attackerEffects: attackerEffectsOf(rules),
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
	rollUseCost?: UseCost;
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
): UseCost {
	if (rule.way !== 'withDefend' || !rule.useReroll) return rule.optionCost;
	const rules = (rule.parentDocument as { rules?: Map<string, ItemRerollRule> } | null)?.rules;
	const rerolls = [...(rules?.values() ?? [])].filter(
		(each) => each.type === 'reroll' && !each.disabled,
	);
	const entryRuleId = card
		? cardRerollFor(card, rule.parentDocument?.uuid, tokenUuid)?.ruleId
		: undefined;
	const reroll =
		rerolls.find((each) => entryRuleId && each.id === entryRuleId) ??
		rerolls.find((each) => each.rolls?.includes('attack'));
	return reroll?.rollUseCost ?? rule.optionCost;
}

/** Whether a Defend option uses this item's reroll, so the reroll waits for the Defend window. */
export function rerollIsUsedByDefend(itemUuid: string | null | undefined): boolean {
	const parent = runningRuleParent<DefendOptionRule>(itemUuid);
	return [...(parent?.rules?.values() ?? [])].some(
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
		itemUuid: pick.rule.parentDocument?.uuid ?? '',
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
		itemUuid: pick.rule.parentDocument?.uuid ?? '',
		label: pick.label,
		cost: null,
		paid: null,
	};
}
