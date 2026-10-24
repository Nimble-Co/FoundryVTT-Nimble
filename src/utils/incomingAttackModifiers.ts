import type { IncomingAttackModifier } from '../models/rules/modifyIncomingAttack.js';
import type { IncomingReactionEntry, RerollRecord, RerollSide } from './incomingReactionEntry.js';
import { DEFAULT_MISS_THRESHOLD } from './missThreshold.js';
import {
	type CardOfferContext,
	collectPoolSpendCardOffers,
	type OfferingActor,
} from './poolSpendCardOffers.js';
import {
	type AutomaticReroll,
	collectRerollEntries,
	nextAutomaticReroll,
	offerStands,
	type RerollingActor,
	type RerollRollOutcome,
	type RerollRuleLike,
} from './rerollEntries.js';
import { type RerollHistory, rerollWithRule } from './rerollStep.js';
import { areAllies, areWithinSpaces } from './tokenAdjacency.js';

// Every hero can Interpose for an ally within 2 spaces (Core Rules heroic
// reaction); rule-granted redirects carry their own range.
const BASELINE_INTERPOSE_RANGE = 2;

const MODIFY_INCOMING_ATTACK_RULE_TYPE = 'modifyIncomingAttack';

interface RuleLike {
	type?: string;
	id?: string;
	label?: string;
	modifier?: IncomingAttackModifier;
	range?: number;
	missThreshold?: number;
	item?: { name?: string; uuid?: string } | null;
	appliesTo?: () => boolean;
}

interface ActorLike {
	uuid?: string;
	type?: string;
	name?: string;
	rules?: RuleLike[];
}

interface IncomingAttackModifierEntry {
	modifier: IncomingAttackModifier;
	/** Rule label or owning item name, surfaced for chat attribution */
	label: string;
	ruleId: string;
	itemUuid: string;
	/** raiseMissThreshold only: the highest primary-die result that misses */
	missThreshold?: number;
}

interface IncomingAttackPlan {
	disadvantageCount: number;
	forceMiss: boolean;
	/** Highest primary-die result that counts as a miss; 1 unless a rule raises it */
	missThreshold: number;
	/** Automatically applied modifiers, for roll metadata */
	appliedEntries: IncomingAttackModifierEntry[];
	/** Interactive prompts (redirectToSelf / reroll / spends) to stamp onto the card */
	reactionEntries: IncomingReactionEntry[];
	/** Automatic rerolls, resolved against the evaluated roll's outcome */
	autoRerollEntries: IncomingReactionEntry[];
	/** The rule behind each automatic `reroll` entry, by entry id */
	rerollRules?: Map<string, RerollRuleLike>;
}

/**
 * Minimal structural view of an evaluated DamageRoll, so this module stays
 * import-cycle-free with the dice layer. Loosened to accept the concrete
 * DamageRoll (whose flags are optional pre-evaluation) without friction.
 */
interface EvaluatedDamageRollLike {
	isCritical?: boolean;
	isMiss?: boolean;
	originalFormula?: string;
	primaryDieValue?: number;
	options: { forceMiss?: boolean; netRollMode?: number; [key: string]: unknown };
	toJSON: () => object;
}

interface PostRollIncomingResult<TRoll> {
	/** The roll that stands (the reroll when one fired, else the original) */
	roll: TRoll;
	/** Serialized original roll when an automatic reroll replaced it */
	discardedRoll: object | null;
	/** Entries to stamp onto the card: filtered offers + used auto-reroll attribution */
	stampEntries: IncomingReactionEntry[];
	/** The automatic `reroll`s in roll order, for the card; null when none ran */
	rerollHistory: RerollHistory | null;
}

type RebuildRoll<TRoll> = (formula: string, options: Record<string, unknown>) => Promise<TRoll>;

function rollOutcomeOf(view: EvaluatedDamageRollLike): RerollRollOutcome {
	return { outcome: view, forcedMiss: view.options?.forceMiss === true };
}

/** The plan's automatic `reroll` entries with their rules, in plan order. */
function automaticRerollsOf(plan: IncomingAttackPlan): AutomaticReroll[] {
	return plan.autoRerollEntries.flatMap((entry) => {
		const rule = entry.kind === 'reroll' ? plan.rerollRules?.get(entry.id) : undefined;
		return rule ? [{ entry, rule }] : [];
	});
}

/**
 * Resolve outcome-dependent incoming-attack behavior after the attack roll has
 * been evaluated, and drop offers the final outcome does not satisfy.
 *
 * Automatic rerolls chain the same way they do on the card: after each one,
 * the next automatic `reroll` rule that matches the new roll runs, and each
 * rule runs at most once. The second result stands each time.
 */
async function applyPostRollIncomingBehavior<TRoll>(
	roll: TRoll,
	plan: IncomingAttackPlan,
	rebuildRoll: RebuildRoll<TRoll>,
): Promise<PostRollIncomingResult<TRoll>> {
	const asView = (r: TRoll) => r as unknown as EvaluatedDamageRollLike;
	let finalRoll = roll;
	let discardedRoll: object | null = null;
	const rerolls: RerollRecord[] = [];
	let discardedCritTriggers = false;
	const stampEntries: IncomingReactionEntry[] = [];

	if (asView(roll).originalFormula) {
		const automatic = automaticRerollsOf(plan);
		let next = nextAutomaticReroll(automatic, stampEntries, rollOutcomeOf(asView(finalRoll)));
		while (next) {
			const replaced = asView(finalRoll);
			const result = await rerollWithRule({
				rule: next.rule,
				entry: next.entry,
				rollKind: 'attack',
				payer: next.rule.actor as Actor | null | undefined,
				replaced,
				previousResult: replaced.primaryDieValue ?? null,
				makeRoll: rebuildRoll,
				earlierCritTriggers: discardedCritTriggers,
			});
			if (result.status === 'failed') throw result.error;
			if (result.status !== 'done') break;

			discardedRoll = replaced.toJSON();
			finalRoll = result.roll;
			rerolls.push(result.reroll);
			discardedCritTriggers = result.discardedCritTriggers;
			stampEntries.push({ ...next.entry, used: true });
			next = nextAutomaticReroll(automatic, stampEntries, rollOutcomeOf(asView(finalRoll)));
		}
	}

	const finalOutcome = rollOutcomeOf(asView(finalRoll));
	stampEntries.push(...plan.reactionEntries.filter((entry) => offerStands(entry, finalOutcome)));

	return {
		roll: finalRoll,
		discardedRoll,
		stampEntries,
		rerollHistory: rerolls.length > 0 ? { rerolls, discardedCritTriggers } : null,
	};
}

function getMatchingRules(actor: ActorLike | null | undefined): RuleLike[] {
	if (!actor?.rules) return [];
	return actor.rules.filter(
		(rule) => rule.type === MODIFY_INCOMING_ATTACK_RULE_TYPE && rule.appliesTo?.(),
	);
}

function toModifierEntry(rule: RuleLike): IncomingAttackModifierEntry {
	return {
		modifier: rule.modifier as IncomingAttackModifier,
		label: rule.label || rule.item?.name || '',
		ruleId: rule.id ?? '',
		itemUuid: rule.item?.uuid ?? '',
		missThreshold: rule.missThreshold ?? DEFAULT_MISS_THRESHOLD,
	};
}

/**
 * Collect the target's own attack-time modifiers. `redirectToSelf` is
 * protector-side and excluded here.
 */
function collectTargetIncomingModifiers(actor: ActorLike | null | undefined) {
	return getMatchingRules(actor)
		.filter((rule) => rule.modifier !== 'redirectToSelf')
		.map(toModifierEntry);
}

/** null = the actor has no numeric HP attribute (e.g. abstracted companions) */
function getActorHpValue(actor: unknown): number | null {
	const value = foundry.utils.getProperty(actor as object, 'system.attributes.hp.value');
	return typeof value === 'number' ? value : null;
}

function isDowned(actor: ActorLike): boolean {
	const hp = getActorHpValue(actor);
	return hp !== null && hp <= 0;
}

function getCandidateTokens(targetToken: Token.Implementation): Token.Implementation[] {
	const combat = game.combat;

	if (combat?.active) {
		const sceneId = targetToken.scene?.id;
		return combat.combatants.contents
			.filter((c) => c.sceneId === sceneId && c.token && c.actor && !c.defeated)
			.map((c) => c.token?.object)
			.filter((t): t is Token.Implementation => t != null && !t.document.hidden);
	}

	return (canvas?.tokens?.placeables ?? []).filter(
		(t): t is Token.Implementation => t != null && !!t.actor && !t.document.hidden,
	);
}

/**
 * Find allies who can offer to take the attack in the target's place: every
 * living allied character within the baseline Interpose range, plus any actor
 * whose `redirectToSelf` rule matches within the rule's own range. When both
 * apply to the same token, the rule-granted offer wins.
 */
function collectRedirectCandidates(targetToken: Token.Implementation): IncomingReactionEntry[] {
	const entriesByToken = new Map<string, IncomingReactionEntry>();
	const targetTokenUuid = targetToken.document.uuid;

	for (const token of getCandidateTokens(targetToken)) {
		if (token === targetToken || token.document.id === targetToken.document.id) continue;

		const actor = token.actor as unknown as ActorLike | null;
		if (!actor) continue;
		if (!areAllies(token, targetToken)) continue;
		if (isDowned(actor)) continue;

		const tokenKey = token.document.id ?? token.document.uuid;
		if (!tokenKey) continue;
		const base = {
			actorUuid: (token.actor?.uuid as string) ?? '',
			tokenUuid: token.document.uuid,
			targetTokenUuid,
			used: false,
		};

		const redirectRules = getMatchingRules(actor).filter(
			(rule) =>
				rule.modifier === 'redirectToSelf' &&
				areWithinSpaces(token, targetToken, rule.range ?? BASELINE_INTERPOSE_RANGE),
		);

		if (redirectRules.length > 0) {
			const entry = toModifierEntry(redirectRules[0]);
			entriesByToken.set(tokenKey, {
				id: foundry.utils.randomID(),
				kind: 'redirectToSelf',
				source: 'rule',
				label: entry.label,
				ruleId: entry.ruleId,
				itemUuid: entry.itemUuid,
				...base,
			});
			continue;
		}

		const isEligibleBaseline =
			actor.type === 'character' && areWithinSpaces(token, targetToken, BASELINE_INTERPOSE_RANGE);

		if (isEligibleBaseline) {
			entriesByToken.set(tokenKey, {
				id: foundry.utils.randomID(),
				kind: 'redirectToSelf',
				source: 'baseline',
				label: '',
				ruleId: '',
				itemUuid: '',
				...base,
			});
		}
	}

	return Array.from(entriesByToken.values());
}

function addRerollEntries(
	plan: IncomingAttackPlan,
	entries: ReturnType<typeof collectRerollEntries>,
	side: RerollSide,
): void {
	plan.reactionEntries.push(...entries.manual.filter((entry) => entry.side === side));
	for (const { entry, rule } of entries.automatic) {
		if (entry.side !== side) continue;
		plan.autoRerollEntries.push(entry);
		plan.rerollRules ??= new Map();
		plan.rerollRules.set(entry.id, rule);
	}
}

/**
 * Compute everything the attack pipeline needs before the roll: the first
 * target's incoming-attack rules, plus the attacker's own outcome-gated spend
 * offers.
 *
 * A forced miss makes the defender's reactions moot, so none are offered
 * alongside it. The attacker's offers are seeded before that early return but
 * are filtered against the resolved outcome afterwards, so a hit- or
 * crit-gated offer still drops out on a forced miss.
 */
function computeIncomingAttackPlan(
	firstTargetToken: Token.Implementation | null | undefined,
	attackingActor?: OfferingActor,
	attackContext?: CardOfferContext,
): IncomingAttackPlan {
	const plan: IncomingAttackPlan = {
		disadvantageCount: 0,
		forceMiss: false,
		missThreshold: DEFAULT_MISS_THRESHOLD,
		appliedEntries: [],
		reactionEntries: [...collectPoolSpendCardOffers(attackingActor, attackContext)],
		autoRerollEntries: [],
	};
	const targetActor = (firstTargetToken?.actor ?? null) as unknown as ActorLike | null;
	const targetModifiers = collectTargetIncomingModifiers(targetActor);

	for (const entry of targetModifiers) {
		if (entry.modifier === 'disadvantage') {
			plan.disadvantageCount += 1;
			plan.appliedEntries.push(entry);
		} else if (entry.modifier === 'autoMiss') {
			plan.forceMiss = true;
			plan.appliedEntries.push(entry);
		} else if (entry.modifier === 'raiseMissThreshold') {
			plan.missThreshold = Math.max(
				plan.missThreshold,
				entry.missThreshold ?? DEFAULT_MISS_THRESHOLD,
			);
			plan.appliedEntries.push(entry);
		}
	}

	const rerolls = collectRerollEntries({
		attacker: attackingActor as RerollingActor | undefined,
		targets: firstTargetToken
			? [{ tokenUuid: firstTargetToken.document.uuid, actor: targetActor as RerollingActor | null }]
			: [],
		roll: { kind: 'attack', delivery: attackContext?.delivery ?? null },
		outcome: null,
		forcedMiss: plan.forceMiss,
	});
	addRerollEntries(plan, rerolls, 'roller');

	if (!firstTargetToken?.actor || plan.forceMiss) return plan;

	addRerollEntries(plan, rerolls, 'target');

	plan.reactionEntries.push(...collectRedirectCandidates(firstTargetToken));

	return plan;
}

export {
	applyPostRollIncomingBehavior,
	BASELINE_INTERPOSE_RANGE,
	collectRedirectCandidates,
	collectTargetIncomingModifiers,
	computeIncomingAttackPlan,
	type IncomingAttackModifierEntry,
	type IncomingAttackPlan,
};
