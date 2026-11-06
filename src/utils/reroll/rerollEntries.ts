import type { CritDiceSpec } from '#types/critDice.d.ts';
import type { DieChange } from '#types/dieChange.d.ts';
import type { ResultCardView, ResultUse } from '#types/resultChange.d.ts';
import { ruleLabel } from '#utils/actor/actorRules.js';
import { isRuleAutomationEnabled } from '../../settings/automationSettings.js';
import { incapacitatedConditionOf, incapacitatedFeature } from '../damage/incapacitatedTarget.js';
import {
	type AttackOutcomeView,
	canBecomeCrit,
	critStays,
	hasCritBonusDice,
	hasCritD20Die,
	hasDieAtMax,
	hasNoDice,
	type IncomingReactionEntry,
	isViciousAttack,
	type RerollDie,
	type RerollKeep,
	type RerollLeftOut,
	type RerollSide,
	type RerollTrigger,
	type RollEffect,
	type RollUse,
	rerollTriggerMatches,
} from '../incomingReactions/incomingReactionEntry.js';
import { soleTarget } from '../tokens/soleTarget.js';
import { type RerollCost, rerollCostCharges } from './rerollCost.js';
import type { RerollChanges } from './rerollOptions.js';
import type { RollToReroll, RollUseKind } from './rollToReroll.js';

const REROLL_RULE_TYPE = 'reroll';
const CHANGE_DIE_RULE_TYPE = 'changeDie';
const MAKE_CRIT_RULE_TYPE = 'makeCrit';
const CHANGE_RESULT_RULE_TYPE = 'changeResult';
const ATTACK_OUTCOME_RULE_TYPE = 'attackOutcome';
const CRIT_DICE_RULE_TYPE = 'critDice';
const CRIT_DICE_SAVE_RULE_TYPE = 'critDiceSave';
const OFFER_ATTACK_BONUS_RULE_TYPE = 'offerAttackBonus';
const INCAPACITATED_TARGET_RULE_ID = 'incapacitatedTarget';

/**
 * The rule types whose entries go on a card as `reroll` entries. With Feature
 * Effects off, an Attack Outcome rule that gives a crit is a Make It a Crit button.
 */
function isRollUseRule(type: string | undefined): boolean {
	if (type === ATTACK_OUTCOME_RULE_TYPE || type === CRIT_DICE_RULE_TYPE) {
		return !isRuleAutomationEnabled();
	}
	if (
		type === CRIT_DICE_SAVE_RULE_TYPE ||
		type === OFFER_ATTACK_BONUS_RULE_TYPE ||
		type === 'keepAmount' ||
		type === 'optionWindow'
	) {
		return true;
	}
	return (
		type === REROLL_RULE_TYPE ||
		type === CHANGE_DIE_RULE_TYPE ||
		type === MAKE_CRIT_RULE_TYPE ||
		type === CHANGE_RESULT_RULE_TYPE
	);
}

/** What an entry of a rule of this type does. Absent is a reroll. */
function rollUseOf(type: string | undefined): RollUse | undefined {
	if (type === CHANGE_DIE_RULE_TYPE) return 'change';
	if (type === MAKE_CRIT_RULE_TYPE || type === ATTACK_OUTCOME_RULE_TYPE) return 'crit';
	if (type === CHANGE_RESULT_RULE_TYPE) return 'result';
	return undefined;
}

/** What an entry of this rule does: a row with an effect, or what the rule type says. */
function rollUseOfRule(rule: RerollRuleLike): RollUse | undefined {
	return rule.rollEffect ? 'effect' : rollUseOf(rule.type);
}

/** What using a Change This Roll row does. The GM runs the row by this kind alone. */
function rollChangeKindOf(
	rule: RerollRuleLike,
):
	| 'reroll'
	| 'change'
	| 'crit'
	| 'result'
	| 'effect'
	| 'critDiceSave'
	| 'keepAmount'
	| 'optionWindow' {
	const use = rollUseOfRule(rule);
	if (use !== 'effect') return use ?? 'reroll';
	const effect = rule.rollEffect;
	if (effect === 'critDiceSave' || effect === 'keepAmount' || effect === 'optionWindow') {
		return effect;
	}
	return 'effect';
}

/** A roll use as the outcome gate reads it. */
interface RollUseGate {
	use?: RollUse;
	effect?: RollEffect;
	/** A crit use that also needs a die of the roll at its max. */
	needsDieAtMax?: boolean;
	/** A use that changes dice of the crit bonus role needs a roll that has them. */
	needsCritBonusDice?: boolean;
}

/** Structural view of a `reroll` rule, so this module needs no rule import. */
interface RerollRuleLike {
	type?: string;
	id?: string;
	/** Modify Reroll rules on the same actor find this rule by it. */
	identifier?: string;
	label?: string;
	disabled?: boolean;
	item?: { name?: string; uuid?: string } | null;
	actor?: unknown;
	outcome?: RerollTrigger;
	rerollsByItself?: boolean;
	discardedCritTriggers?: boolean;
	oncePerRoll?: boolean;
	reach?: number;
	die?: RerollDie;
	keep?: RerollKeep;
	rollUseCost?: RerollCost;
	offersUseOn?: (context: {
		side: RerollSide;
		roll: RollToReroll;
		other: RerollingActor | null;
		card?: ResultCardView;
		targetTokenUuid?: string | null;
	}) => boolean;
	rerollChanges?: (kind: RollUseKind) => RerollChanges;
	/** A Reroll rule: the player picks another stat for the new roll. */
	usesAnotherStat?: boolean;
	/** The stat the rule is limited to. Empty is any. */
	relatedStat?: string;
	/** A Change a Result rule: how it changes the result. */
	change?: ResultUse['change'];
	/** Replaces `outcome` on an attack, for a rule whose `outcome` is about a check. */
	attackTrigger?: RerollTrigger;
	/** A Change a Die rule: the change one use makes. */
	dieChange?: DieChange;
	/** A Change a Result rule: what one use does, or null when its formula gives no number. */
	resultUseFor?: (roller: ResultCardView['roller'], card?: ResultCardView) => ResultUse | null;
	/** With Feature Effects off, what the row of this rule does to the roll. */
	rollEffect?: RollEffect;
	/** The most dice a player can pick for one use; null is one die. */
	maxDiceCount?: number | null;
	/** How many rows the rule gives this roll. Absent is one. */
	rowsOn?(context: { roll: RollToReroll }): number;
	/** With the effect `offerBonus`: what the row adds. */
	offerBonus?: { label: string; damage: number; primaryDie: number };
	/** With the effect `critDiceSave`: the save the target makes, and its DC. */
	saveType?: string;
	saveDC?: string;
	/** With the effect `critDice`: the dice the row adds. */
	critDiceSpec?: CritDiceSpec;
	/** A rule that changes dice of the crit bonus role. */
	needsCritBonusDice?: boolean;
	/** An Attack Outcome rule as a button: its crit also needs a die at its max. */
	critNeedsDieAtMax?: boolean;
	cardHintFor?: (context: {
		side: RerollSide;
		roll: RollToReroll;
		other: RerollingActor | null;
	}) => string;
}

interface RerollingActor {
	uuid?: string;
	isOwner?: boolean;
	rules?: RerollRuleLike[];
	getTargetDomain?(): Set<string>;
	getRollData?(): Record<string, unknown>;
}

/**
 * With Feature Effects off, the crit of a melee hit against a target in the
 * Incapacitated group is a free Make It a Crit button. No item holds this rule.
 */
function incapacitatedTargetRule(other: RerollingActor | null): RerollRuleLike {
	const condition = incapacitatedConditionOf(other);
	return {
		type: MAKE_CRIT_RULE_TYPE,
		id: INCAPACITATED_TARGET_RULE_ID,
		label: condition ? incapacitatedFeature(condition) : '',
		outcome: 'hit',
		offersUseOn: (context) =>
			!isRuleAutomationEnabled() &&
			context.side === 'roller' &&
			context.roll.kind === 'attack' &&
			context.roll.delivery === 'melee' &&
			incapacitatedConditionOf(context.other) !== null,
	};
}

interface RerollTarget {
	tokenUuid: string | null;
	actor: RerollingActor | null | undefined;
}

/**
 * A creature that may use an ally-side reroll on this roll, as the scan found it
 * when the card was posted. `isAlly` is false when the scan does not count it as
 * an ally of the one who rolled; its rerolls are then left out.
 */
interface RerollAlly {
	tokenUuid: string;
	actor: RerollingActor | null | undefined;
	isAlly: boolean;
	spaces: number;
}

/** One roll as the reroll gate sees it. The caller builds it once per roll. */
interface RerollRollContext {
	attacker: RerollingActor | null | undefined;
	/** The roll's targets in card order. With two or more, no target's rules give entries. */
	targets: RerollTarget[];
	/** The item's extra targets do not count: only the first target's rules are read. */
	firstTargetDecides?: boolean;
	/** Creatures that may use an ally-side reroll. Absent means none. */
	allies?: RerollAlly[];
	roll: RollToReroll;
	/** Attacks only. Null before the roll is made. */
	outcome: AttackOutcomeView | null;
	/** Attacks only. A forced miss stays a miss on any reroll. */
	forcedMiss: boolean;
	/** A check card's result now, for the live gate. Absent before the card exists. */
	card?: ResultCardView;
	/** A check being posted: a rule for a failed roll can still run by itself. */
	rollTimeOfCheck?: boolean;
}

type RerollRollOutcome = Pick<RerollRollContext, 'outcome' | 'forcedMiss'>;

/** A reroll that happens by itself when the roll is made. */
interface AutomaticReroll {
	entry: IncomingReactionEntry;
	rule: RerollRuleLike;
}

/** Whether a stamped entry can be used now, and from what. */
type UsableReroll =
	| { ok: true; rule: RerollRuleLike; actor: Actor.Implementation }
	| { ok: false; reason: 'unavailable' | 'forcedMiss' };

const UNAVAILABLE: UsableReroll = { ok: false, reason: 'unavailable' };

const NO_OUTCOME: RerollRollOutcome = { outcome: null, forcedMiss: false };

/** The roll's outcome as the gate reads it. A check has none. */
function attackOutcome(context: RerollRollContext): RerollRollOutcome {
	if (context.roll.kind !== 'attack') return NO_OUTCOME;
	return { outcome: context.outcome, forcedMiss: context.forcedMiss };
}

/**
 * Whether a roll use with this trigger fits the outcome. A crit that stays has
 * no crit-only use, and a crit use needs a roll that can still be made a crit.
 */
function rollUseTriggerMatches(
	trigger: RerollTrigger | null | undefined,
	outcome: AttackOutcomeView,
	gate: RollUseGate = {},
): boolean {
	if (hasNoDice(outcome) && gate.use !== 'result' && gate.effect !== 'keepAmount') return false;
	if (gate.effect === 'viciousDie' && isViciousAttack(outcome)) return false;
	if (gate.effect === 'critD20' && hasCritD20Die(outcome)) return false;
	if (gate.use === 'crit' && !canBecomeCrit(outcome)) return false;
	if (gate.needsDieAtMax && !hasDieAtMax(outcome)) return false;
	if (gate.needsCritBonusDice && !hasCritBonusDice(outcome)) return false;
	if (gate.effect === 'critDice' && hasCritBonusDice(outcome)) return false;
	if (trigger === 'criticalHit' && !gate.effect && critStays(outcome)) return false;
	return rerollTriggerMatches(trigger, outcome);
}

function outcomeAllows(
	trigger: RerollTrigger | null | undefined,
	roll: RerollRollOutcome,
	gate: RollUseGate = {},
): boolean {
	if (roll.forcedMiss) return false;
	return !roll.outcome || rollUseTriggerMatches(trigger, roll.outcome, gate);
}

/** The outcome of an attack this rule fits. */
function triggerOf(rule: RerollRuleLike): RerollTrigger | undefined {
	return rule.attackTrigger ?? rule.outcome;
}

/**
 * Whether a rule happens by itself on this roll. On a check, a rule for a failed
 * roll needs a known result, which only the check's posting step reads.
 */
function runsByItself(
	rule: RerollRuleLike,
	actor: RerollingActor,
	context: RerollRollContext,
): boolean {
	if (!rerollsByItself(rule, actor)) return false;
	return context.roll.kind === 'attack' || rule.outcome !== 'failed' || !!context.rollTimeOfCheck;
}

function gateOf(rule: RerollRuleLike): RollUseGate {
	const use = rollUseOfRule(rule);
	return {
		...(use ? { use } : {}),
		...(rule.rollEffect ? { effect: rule.rollEffect } : {}),
		...(rule.critNeedsDieAtMax === true ? { needsDieAtMax: true } : {}),
		...(rule.needsCritBonusDice === true ? { needsCritBonusDice: true } : {}),
	};
}

/**
 * Whether a reroll rule happens by itself. That needs the rule's `automatic`
 * field and the rule automation toggle. A cost that charges something can only
 * be paid on a client that owns the paying actor, so elsewhere it shows as a
 * button for the owner instead.
 */
function rerollsByItself(rule: RerollRuleLike, actor: RerollingActor): boolean {
	if (rule.rerollsByItself !== true || !isRuleAutomationEnabled()) return false;
	if (!rule.rollUseCost || !rerollCostCharges(rule.rollUseCost)) return true;
	return actor.isOwner === true;
}

interface RerollUser {
	actor: RerollingActor | null | undefined;
	tokenUuid: string | null;
	targetTokenUuid: string | null;
	ally?: RerollAlly;
}

/**
 * The creature on the other side of the roll from `side`: the target for the
 * one who rolled and an ally, the one who rolled for the target. With two or
 * more targets there is none, so a rule that tests it does not run.
 */
function otherCreature(side: RerollSide, context: RerollRollContext): RerollingActor | null {
	if (side === 'target') return context.attacker ?? null;
	return soleTarget(context.targets, { firstDecides: context.firstTargetDecides })?.actor ?? null;
}

/** Who can use a rule on each side of this roll. */
function rerollUsers(side: RerollSide, context: RerollRollContext): RerollUser[] {
	if (side === 'roller')
		return [{ actor: context.attacker, tokenUuid: null, targetTokenUuid: null }];
	if (side === 'target') {
		return context.targets.map((target) => ({
			actor: target.actor,
			tokenUuid: null,
			targetTokenUuid: target.tokenUuid ?? null,
		}));
	}
	const rollerUuid = context.attacker?.uuid;
	return (context.allies ?? [])
		.filter((ally) => !!ally.actor && ally.actor.uuid !== rollerUuid)
		.map((ally) => ({ actor: ally.actor, tokenUuid: ally.tokenUuid, targetTokenUuid: null, ally }));
}

function leftOutFor(rule: RerollRuleLike, ally: RerollAlly): RerollLeftOut | null {
	if (!ally.isAlly) return { reason: 'disposition' };
	const reach = Math.max(0, Number(rule.reach) || 0);
	if (reach > 0 && ally.spaces > reach) return { reason: 'reach', spaces: ally.spaces, reach };
	return null;
}

/** On a roll with two or more targets, only a rule about one target's damage gives an entry. */
function fitsTargetCount(
	rule: RerollRuleLike,
	side: RerollSide,
	context: RerollRollContext,
	targetTokenUuid: string | null,
): boolean {
	if (side !== 'target' || context.targets.length < 2 || rule.change === 'noDamage') return true;
	return context.firstTargetDecides === true && context.targets[0]?.tokenUuid === targetTokenUuid;
}

/**
 * The reroll entries the attacker's, the first target's and the allies' `reroll`
 * rules give this roll, split into buttons and rerolls that happen by themselves.
 * An ally's reroll that the scan left out is still listed, with `leftOut` set.
 * Before the roll, the outcome is checked later with `offerStands`.
 */
function collectRerollEntries(context: RerollRollContext): {
	manual: IncomingReactionEntry[];
	automatic: AutomaticReroll[];
} {
	const result = { manual: [] as IncomingReactionEntry[], automatic: [] as AutomaticReroll[] };
	const outcome = attackOutcome(context);
	if (outcome.forcedMiss) return result;
	const isAttack = context.roll.kind === 'attack';

	for (const side of ['roller', 'target', 'ally'] as const) {
		const other = otherCreature(side, context);
		for (const { actor, tokenUuid, targetTokenUuid, ally } of rerollUsers(side, context)) {
			const actorUuid = actor?.uuid ?? '';
			if (!actor || !actorUuid || !Array.isArray(actor.rules)) continue;

			const rules =
				side === 'roller' ? [...actor.rules, incapacitatedTargetRule(other)] : actor.rules;
			for (const rule of rules) {
				if (!isRollUseRule(rule?.type)) continue;
				if (!fitsTargetCount(rule, side, context, targetTokenUuid)) continue;
				if (rule.offersUseOn?.({ side, roll: context.roll, other }) !== true) continue;
				const trigger = isAttack ? (triggerOf(rule) ?? 'always') : 'always';
				const gate = gateOf(rule);
				if (!outcomeAllows(trigger, outcome, gate)) continue;
				const hint = rule.cardHintFor?.({ side, roll: context.roll, other }) ?? '';

				const rows = Math.max(1, rule.rowsOn?.({ roll: context.roll }) ?? 1);
				for (let useIndex = 0; useIndex < rows; useIndex += 1) {
					const entry: IncomingReactionEntry = {
						id: foundry.utils.randomID(),
						kind: 'reroll',
						source: 'rule',
						actorUuid,
						tokenUuid,
						targetTokenUuid,
						side,
						label: ruleLabel(rule),
						ruleId: rule.id ?? '',
						itemUuid: rule.item?.uuid ?? '',
						used: false,
						outcomeTrigger: trigger,
						oncePerRoll: rule.oncePerRoll === true,
						...gate,
						...(hint ? { hint } : {}),
						...(rule.usesAnotherStat === true ? { anotherStat: true } : {}),
						...(ally ? { leftOut: leftOutFor(rule, ally) } : {}),
						...(rows > 1 ? { useIndex } : {}),
					};

					if (!ally && runsByItself(rule, actor, context)) result.automatic.push({ entry, rule });
					else result.manual.push(entry);
				}
			}
		}
	}

	return result;
}

/**
 * Whether a pending offer still belongs on a roll that resolved this way. A
 * `reroll` entry never stands on a forced miss. Every kind is gated by
 * `outcomeTrigger`, and an offer without one always stands. Before the roll is
 * made, every offer stands.
 */
function offerStands(entry: IncomingReactionEntry, roll: RerollRollOutcome): boolean {
	if (entry.kind === 'reroll') return outcomeAllows(entry.outcomeTrigger, roll, entry);
	if (!roll.outcome) return true;
	return rerollTriggerMatches(entry.outcomeTrigger, roll.outcome);
}

/** One `reroll` rule on one actor, so a rule is not added or run twice on a card. */
function rerollRuleKey(
	entry: Pick<IncomingReactionEntry, 'actorUuid' | 'itemUuid' | 'ruleId' | 'useIndex'>,
): string {
	const base = `${entry.actorUuid}|${entry.itemUuid}|${entry.ruleId}`;
	return entry.useIndex ? `${base}|${entry.useIndex}` : base;
}

function rerollRuleKeys(entries: IncomingReactionEntry[]): Set<string> {
	return new Set(entries.filter((entry) => entry.kind === 'reroll').map(rerollRuleKey));
}

/** Whether another entry of the same rule is already used on the card. */
function ruleUsedOnCard(
	entry: IncomingReactionEntry,
	cardEntries: IncomingReactionEntry[],
): boolean {
	const key = rerollRuleKey(entry);
	return cardEntries.some(
		(other) =>
			other.id !== entry.id &&
			other.kind === 'reroll' &&
			other.used &&
			rerollRuleKey(other) === key,
	);
}

/**
 * The card's entries with the new reroll buttons added. A rule that already
 * has an entry waiting is not added twice. A rule that was used gets a new
 * entry, unless the new entry has `oncePerRoll`.
 */
function withNewRerollEntries(
	entries: IncomingReactionEntry[],
	found: IncomingReactionEntry[],
): IncomingReactionEntry[] {
	const waiting = rerollRuleKeys(entries.filter((entry) => !entry.used));
	const added = found.filter(
		(entry) =>
			!waiting.has(rerollRuleKey(entry)) &&
			!(entry.oncePerRoll === true && ruleUsedOnCard(entry, entries)),
	);
	return [...entries, ...added];
}

/**
 * The automatic reroll that may run next on this roll: the first one that
 * stands and whose rule has no entry on the card, used or waiting. So each
 * automatic rule runs at most once per card.
 */
function nextAutomaticReroll(
	automatic: AutomaticReroll[],
	entries: IncomingReactionEntry[],
	roll: RerollRollOutcome,
): AutomaticReroll | null {
	const onCard = rerollRuleKeys(entries);
	return (
		automatic.find(({ entry }) => !onCard.has(rerollRuleKey(entry)) && offerStands(entry, roll)) ??
		null
	);
}

/** The live roll use rule an entry came from, or null when it is gone or off. */
function findRerollRule(entry: IncomingReactionEntry): RerollRuleLike | null {
	if (entry.ruleId === INCAPACITATED_TARGET_RULE_ID) return incapacitatedTargetRule(null);
	if (!entry.itemUuid) return null;
	const item = fromUuidSync(entry.itemUuid as `Item.${string}`) as {
		rules?: Map<string, RerollRuleLike>;
	} | null;
	const rule = item?.rules
		? [...item.rules.values()].find((candidate) => candidate.id === entry.ruleId)
		: null;
	if (!rule || !isRollUseRule(rule.type) || rule.disabled) return null;
	return rule;
}

/**
 * Whether the entry's actor is still on its side of the roll: the attacker
 * for a roller entry, anyone but the attacker for an ally entry (the scan
 * decided once, at post), the actor of a token still among the targets otherwise.
 */
function isOnSide(entry: IncomingReactionEntry, side: RerollSide, context: RerollRollContext) {
	if (side === 'roller') return context.attacker?.uuid === entry.actorUuid;
	if (side === 'ally') return !!entry.actorUuid && context.attacker?.uuid !== entry.actorUuid;
	const tokenUuid = entry.targetTokenUuid ?? '';
	const target = context.targets.find((candidate) => candidate.tokenUuid === tokenUuid);
	return target?.actor?.uuid === entry.actorUuid;
}

/**
 * Check a stamped entry again from its live rule and the card's entries, on
 * the client that uses it. An entry with no side is not usable.
 */
function usableRerollEntry(
	entry: IncomingReactionEntry,
	context: RerollRollContext,
	cardEntries: IncomingReactionEntry[],
): UsableReroll {
	const rule = findRerollRule(entry);
	const actor = fromUuidSync(entry.actorUuid as `Actor.${string}`) as Actor.Implementation | null;
	if (!rule || !actor || !entry.side || entry.leftOut) return UNAVAILABLE;
	if (!isOnSide(entry, entry.side, context)) return UNAVAILABLE;
	const isAttack = context.roll.kind === 'attack';
	if (rule.oncePerRoll === true && ruleUsedOnCard(entry, cardEntries)) return UNAVAILABLE;
	const other = otherCreature(entry.side, context);
	// A rule that reads the card keeps its entry stamped, so the row comes back with the result.
	const readsCard = !isAttack || rollUseOfRule(rule) === 'result';
	const gate = {
		side: entry.side,
		roll: context.roll,
		other,
		...(readsCard && context.card ? { card: context.card } : {}),
		...(rollUseOfRule(rule) === 'result' ? { targetTokenUuid: entry.targetTokenUuid } : {}),
	};
	if (rule.offersUseOn?.(gate) !== true) return UNAVAILABLE;
	const { outcome, forcedMiss } = attackOutcome(context);
	if (outcome && !rollUseTriggerMatches(triggerOf(rule), outcome, gateOf(rule))) {
		return UNAVAILABLE;
	}
	if (forcedMiss) return { ok: false, reason: 'forcedMiss' };
	return { ok: true, rule, actor };
}

export {
	CHANGE_DIE_RULE_TYPE,
	collectRerollEntries,
	findRerollRule,
	isRollUseRule,
	rollChangeKindOf,
	rollUseOfRule,
	MAKE_CRIT_RULE_TYPE,
	nextAutomaticReroll,
	offerStands,
	REROLL_RULE_TYPE,
	rerollRuleKey,
	rollUseOf,
	usableRerollEntry,
	withNewRerollEntries,
	type AutomaticReroll,
	type RerollAlly,
	type RerollingActor,
	type RerollRollContext,
	type RerollRollOutcome,
	type RerollRuleLike,
	type RerollTarget,
	type UsableReroll,
};
