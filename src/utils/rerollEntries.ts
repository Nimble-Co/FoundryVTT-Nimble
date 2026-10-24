import { isRuleAutomationEnabled } from '../settings/automationSettings.js';
import type { AttackDelivery } from './attackDelivery.js';
import {
	type AttackOutcomeView,
	type IncomingReactionEntry,
	type RerollSide,
	type RerollTrigger,
	rerollTriggerMatches,
} from './incomingReactionEntry.js';
import { type RerollCost, rerollCostCharges } from './rerollCost.js';
import type { RerollChanges } from './rerollOptions.js';

const REROLL_RULE_TYPE = 'reroll';

/** Structural view of a `reroll` rule, so this module needs no rule import. */
interface RerollRuleLike {
	type?: string;
	id?: string;
	label?: string;
	disabled?: boolean;
	item?: { name?: string; uuid?: string } | null;
	actor?: unknown;
	outcome?: RerollTrigger;
	automatic?: boolean;
	discardedCritTriggers?: boolean;
	oncePerRoll?: boolean;
	rerollCost?: RerollCost;
	offersRerollOn?: (context: { side: RerollSide; delivery: AttackDelivery }) => boolean;
	rerollChanges?: () => RerollChanges;
}

interface RerollingActor {
	uuid?: string;
	isOwner?: boolean;
	rules?: RerollRuleLike[];
}

interface RerollTarget {
	tokenUuid: string | null;
	actor: RerollingActor | null | undefined;
}

/** One roll as the reroll gate sees it. The caller builds it once per roll. */
interface RerollRollContext {
	attacker: RerollingActor | null | undefined;
	/** The roll's targets in card order. Only the first one's rules give entries. */
	targets: RerollTarget[];
	delivery: AttackDelivery;
	/** Null before the roll is made. */
	outcome: AttackOutcomeView | null;
	/** A forced miss stays a miss on any reroll. */
	forcedMiss: boolean;
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

function outcomeAllows(
	trigger: RerollTrigger | null | undefined,
	roll: RerollRollOutcome,
): boolean {
	if (roll.forcedMiss) return false;
	return !roll.outcome || rerollTriggerMatches(trigger, roll.outcome);
}

/**
 * Whether a reroll rule happens by itself. That needs the rule's `automatic`
 * field and the rule automation toggle. A cost that charges something can only
 * be paid on a client that owns the paying actor, so elsewhere it shows as a
 * button for the owner instead.
 */
function rerollsByItself(rule: RerollRuleLike, actor: RerollingActor): boolean {
	if (rule.automatic !== true || !isRuleAutomationEnabled()) return false;
	if (!rule.rerollCost || !rerollCostCharges(rule.rerollCost)) return true;
	return actor.isOwner === true;
}

function rollingActorFor(side: RerollSide, context: RerollRollContext) {
	if (side === 'roller') return { actor: context.attacker, targetTokenUuid: null };
	const target = context.targets[0];
	return { actor: target?.actor, targetTokenUuid: target?.tokenUuid ?? null };
}

/**
 * The reroll entries the attacker's and the first target's `reroll` rules
 * give this roll, split into buttons and rerolls that happen by themselves.
 * Before the roll, the outcome is checked later with `offerStands`.
 */
function collectRerollEntries(context: RerollRollContext): {
	manual: IncomingReactionEntry[];
	automatic: AutomaticReroll[];
} {
	const result = { manual: [] as IncomingReactionEntry[], automatic: [] as AutomaticReroll[] };
	if (context.forcedMiss) return result;

	for (const side of ['roller', 'target'] as const) {
		const { actor, targetTokenUuid } = rollingActorFor(side, context);
		const actorUuid = actor?.uuid ?? '';
		if (!actor || !actorUuid || !Array.isArray(actor.rules)) continue;

		for (const rule of actor.rules) {
			if (rule?.type !== REROLL_RULE_TYPE) continue;
			if (rule.offersRerollOn?.({ side, delivery: context.delivery }) !== true) continue;
			if (!outcomeAllows(rule.outcome, context)) continue;

			const entry: IncomingReactionEntry = {
				id: foundry.utils.randomID(),
				kind: 'reroll',
				source: 'rule',
				actorUuid,
				tokenUuid: null,
				targetTokenUuid,
				side,
				label: rule.label || rule.item?.name || '',
				ruleId: rule.id ?? '',
				itemUuid: rule.item?.uuid ?? '',
				used: false,
				outcomeTrigger: rule.outcome ?? 'always',
				oncePerRoll: rule.oncePerRoll === true,
			};

			if (rerollsByItself(rule, actor)) result.automatic.push({ entry, rule });
			else result.manual.push(entry);
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
	if (entry.kind === 'reroll') return outcomeAllows(entry.outcomeTrigger, roll);
	if (!roll.outcome) return true;
	return rerollTriggerMatches(entry.outcomeTrigger, roll.outcome);
}

/** One `reroll` rule on one actor, so a rule is not added or run twice on a card. */
function rerollRuleKey(
	entry: Pick<IncomingReactionEntry, 'actorUuid' | 'itemUuid' | 'ruleId'>,
): string {
	return `${entry.actorUuid}|${entry.itemUuid}|${entry.ruleId}`;
}

function rerollRuleKeys(entries: IncomingReactionEntry[]): Set<string> {
	return new Set(entries.filter((entry) => entry.kind === 'reroll').map(rerollRuleKey));
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
	const used = rerollRuleKeys(entries.filter((entry) => entry.used));
	const added = found.filter((entry) => {
		const key = rerollRuleKey(entry);
		return !waiting.has(key) && !(entry.oncePerRoll === true && used.has(key));
	});
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

/** The live `reroll` rule an entry came from, or null when it is gone or off. */
function findRerollRule(entry: IncomingReactionEntry): RerollRuleLike | null {
	if (!entry.itemUuid) return null;
	const item = fromUuidSync(entry.itemUuid as `Item.${string}`) as {
		rules?: Map<string, RerollRuleLike>;
	} | null;
	const rule = item?.rules
		? [...item.rules.values()].find((candidate) => candidate.id === entry.ruleId)
		: null;
	if (!rule || rule.type !== REROLL_RULE_TYPE || rule.disabled) return null;
	return rule;
}

/**
 * Whether the entry's actor is still on its side of the roll: the attacker
 * for a roller entry, the actor of a token still among the targets otherwise.
 */
function isOnSide(entry: IncomingReactionEntry, side: RerollSide, context: RerollRollContext) {
	if (side === 'roller') return context.attacker?.uuid === entry.actorUuid;
	const tokenUuid = entry.targetTokenUuid ?? '';
	const target = context.targets.find((candidate) => candidate.tokenUuid === tokenUuid);
	return target?.actor?.uuid === entry.actorUuid;
}

/** Whether another entry of the same rule is already used on the card. */
function ruleUsedOnCard(entry: IncomingReactionEntry, cardEntries: IncomingReactionEntry[]) {
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
	if (!rule || !actor || !entry.side) return UNAVAILABLE;
	if (!isOnSide(entry, entry.side, context)) return UNAVAILABLE;
	if (rule.oncePerRoll === true && ruleUsedOnCard(entry, cardEntries)) return UNAVAILABLE;
	if (rule.offersRerollOn?.({ side: entry.side, delivery: context.delivery }) !== true) {
		return UNAVAILABLE;
	}
	if (context.outcome && !rerollTriggerMatches(rule.outcome, context.outcome)) return UNAVAILABLE;
	if (context.forcedMiss) return { ok: false, reason: 'forcedMiss' };
	return { ok: true, rule, actor };
}

export {
	collectRerollEntries,
	findRerollRule,
	nextAutomaticReroll,
	offerStands,
	rerollRuleKey,
	usableRerollEntry,
	withNewRerollEntries,
	type AutomaticReroll,
	type RerollingActor,
	type RerollRollContext,
	type RerollRollOutcome,
	type RerollRuleLike,
	type RerollTarget,
	type UsableReroll,
};
