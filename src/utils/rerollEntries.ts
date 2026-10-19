import { isRuleAutomationEnabled } from '../settings/automationSettings.js';
import type { AttackDelivery } from './attackDelivery.js';
import type { IncomingReactionEntry, RerollTrigger } from './incomingReactionEntry.js';
import { type RerollCost, rerollCostCharges } from './rerollCost.js';
import type { RerollChanges } from './rerollOptions.js';

const REROLL_RULE_TYPE = 'reroll';

type RerollSide = 'roller' | 'target';

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
	rerollCost?: RerollCost;
	offersRerollOn?: (context: { side: RerollSide; delivery: AttackDelivery }) => boolean;
	rerollChanges?: () => RerollChanges;
}

interface RerollingActor {
	uuid?: string;
	isOwner?: boolean;
	rules?: RerollRuleLike[];
}

interface RerollEntryContext {
	side: RerollSide;
	delivery: AttackDelivery;
	/** The attack's target token; set for target-side entries only */
	targetTokenUuid: string | null;
}

/** A reroll that happens by itself when the roll is made. */
interface AutomaticReroll {
	entry: IncomingReactionEntry;
	rule: RerollRuleLike;
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

/**
 * Build the reroll entries an actor's `reroll` rules give one side of an
 * attack. The roll's outcome is checked later, against the roll that stands.
 */
function collectRerollEntries(
	actor: RerollingActor | null | undefined,
	context: RerollEntryContext,
): { manual: IncomingReactionEntry[]; automatic: AutomaticReroll[] } {
	const result = { manual: [] as IncomingReactionEntry[], automatic: [] as AutomaticReroll[] };
	const actorUuid = actor?.uuid ?? '';
	if (!actor || !actorUuid || !Array.isArray(actor.rules)) return result;

	for (const rule of actor.rules) {
		if (rule?.type !== REROLL_RULE_TYPE) continue;
		if (rule.offersRerollOn?.({ side: context.side, delivery: context.delivery }) !== true) {
			continue;
		}

		const entry: IncomingReactionEntry = {
			id: foundry.utils.randomID(),
			kind: 'reroll',
			source: 'rule',
			actorUuid,
			tokenUuid: null,
			targetTokenUuid: context.side === 'target' ? context.targetTokenUuid : null,
			label: rule.label || rule.item?.name || '',
			ruleId: rule.id ?? '',
			itemUuid: rule.item?.uuid ?? '',
			used: false,
			outcomeTrigger: rule.outcome ?? 'always',
		};

		if (rerollsByItself(rule, actor)) result.automatic.push({ entry, rule });
		else result.manual.push(entry);
	}

	return result;
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

export {
	collectRerollEntries,
	findRerollRule,
	type AutomaticReroll,
	type RerollingActor,
	type RerollRuleLike,
	type RerollSide,
};
