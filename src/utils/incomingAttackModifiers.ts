import type { IncomingAttackModifier } from '../models/rules/modifyIncomingAttack.js';
import { areAllies, areWithinSpaces } from './tokenAdjacency.js';

// Every hero can Interpose for an ally within 2 spaces (Core Rules heroic
// reaction); rule-granted redirects carry their own range.
const BASELINE_INTERPOSE_RANGE = 2;

const MODIFY_INCOMING_ATTACK_RULE_TYPE = 'modifyIncomingAttack';

type RerollTrigger = 'always' | 'hit' | 'criticalHit';

interface RuleLike {
	type?: string;
	id?: string;
	label?: string;
	modifier?: IncomingAttackModifier;
	range?: number;
	automatic?: boolean;
	rerollTrigger?: RerollTrigger;
	rerollWithDisadvantage?: boolean;
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
	/** forceReroll only: execute at roll time instead of offering a button */
	automatic?: boolean;
	/** forceReroll only: when the reroll applies */
	rerollTrigger?: RerollTrigger;
	/** forceReroll only: roll the reroll at disadvantage */
	rerollWithDisadvantage?: boolean;
}

/**
 * A pending interactive reaction stamped onto the attack chat card. Entries
 * are snapshotted on the attacker's client at card creation so every client
 * sees the same offer; executors revalidate lightly on use.
 */
interface IncomingReactionEntry {
	id: string;
	kind: 'forceReroll' | 'redirectToSelf';
	/** `baseline` = universal heroic Interpose; `rule` = granted by a modifyIncomingAttack rule */
	source: 'baseline' | 'rule';
	/** Reacting actor (token-actor uuid, so unlinked tokens resolve) */
	actorUuid: string;
	/** Protector's token (redirect only) */
	tokenUuid: string | null;
	/** Token whose targeting the redirect replaces (redirect only) */
	targetTokenUuid: string | null;
	label: string;
	ruleId: string;
	itemUuid: string;
	used: boolean;
	/** forceReroll only: gate the offer/execution on the roll's outcome */
	rerollTrigger?: RerollTrigger;
	/** forceReroll only: roll the reroll at disadvantage */
	rerollWithDisadvantage?: boolean;
}

interface IncomingAttackPlan {
	disadvantageCount: number;
	forceMiss: boolean;
	/** Automatically applied modifiers (disadvantage / autoMiss), for roll metadata */
	appliedEntries: IncomingAttackModifierEntry[];
	/** Interactive prompts (forceReroll / redirectToSelf) to stamp onto the card */
	reactionEntries: IncomingReactionEntry[];
	/** Automatic rerolls, resolved against the evaluated roll's outcome */
	autoRerollEntries: IncomingReactionEntry[];
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
	options: { forceMiss?: boolean; netRollMode?: number; [key: string]: unknown };
	toJSON: () => object;
}

/** Does the roll's outcome satisfy a forceReroll trigger? */
function rerollTriggerMatches(
	trigger: RerollTrigger | undefined,
	view: EvaluatedDamageRollLike,
): boolean {
	switch (trigger) {
		case 'criticalHit':
			return !!view.isCritical;
		case 'hit':
			return !view.isMiss;
		default:
			return true; // 'always'
	}
}

/**
 * Return a copy of roll options with one disadvantage level appended (used by
 * "reroll at disadvantage" rules). netRollMode is dropped so the DamageRoll
 * constructor recomputes it from the sources.
 */
function withRerollDisadvantage(options: Record<string, unknown>): Record<string, unknown> {
	const rollMode = typeof options.rollMode === 'number' ? options.rollMode : 0;
	const sources = Array.isArray(options.rollModeSources)
		? [...(options.rollModeSources as number[])]
		: [rollMode];
	sources.push(-1);
	const next = { ...options, rollModeSources: sources };
	delete (next as { netRollMode?: number }).netRollMode;
	return next;
}

interface PostRollIncomingResult<TRoll> {
	/** The roll that stands (the reroll when one fired, else the original) */
	roll: TRoll;
	/** Serialized original roll when an automatic reroll replaced it */
	discardedRoll: object | null;
	/** Entries to stamp onto the card: filtered offers + used auto-reroll attribution */
	stampEntries: IncomingReactionEntry[];
}

/**
 * Resolve outcome-dependent incoming-attack behavior after the attack roll has
 * been evaluated: execute the first matching automatic reroll (the second
 * result stands), and drop interactive reroll offers whose trigger the final
 * outcome does not satisfy.
 */
async function applyPostRollIncomingBehavior<TRoll>(
	roll: TRoll,
	plan: IncomingAttackPlan,
	rebuildRoll: (formula: string, options: Record<string, unknown>) => Promise<TRoll>,
): Promise<PostRollIncomingResult<TRoll>> {
	const asView = (r: TRoll) => r as unknown as EvaluatedDamageRollLike;
	let finalRoll = roll;
	let discardedRoll: object | null = null;
	const stampEntries: IncomingReactionEntry[] = [];

	const view = asView(roll);
	const autoEntry = plan.autoRerollEntries.find((entry) =>
		rerollTriggerMatches(entry.rerollTrigger, view),
	);

	if (autoEntry && !view.options.forceMiss) {
		// netRollMode is recomputed from rollModeSources; carrying the stale
		// value forward would double-apply it.
		let options: Record<string, unknown> = { ...view.options };
		delete options.netRollMode;
		if (autoEntry.rerollWithDisadvantage) options = withRerollDisadvantage(options);
		const formula = view.originalFormula ?? '';

		if (formula) {
			discardedRoll = view.toJSON();
			finalRoll = await rebuildRoll(formula, options);
			stampEntries.push({ ...autoEntry, used: true });
		}
	}

	const finalView = asView(finalRoll);
	stampEntries.push(
		...plan.reactionEntries.filter(
			(entry) =>
				entry.kind !== 'forceReroll' || rerollTriggerMatches(entry.rerollTrigger, finalView),
		),
	);

	return { roll: finalRoll, discardedRoll, stampEntries };
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
		automatic: rule.automatic ?? false,
		rerollTrigger: rule.rerollTrigger ?? 'always',
		rerollWithDisadvantage: rule.rerollWithDisadvantage ?? false,
	};
}

/**
 * Collect the target's own attack-time modifiers (disadvantage, forceReroll,
 * autoMiss). `redirectToSelf` is protector-side and excluded here.
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

/**
 * Compute everything the attack pipeline needs from the first target's
 * incoming-attack rules. A forced miss makes the reactions moot, so none are
 * offered alongside it.
 */
function computeIncomingAttackPlan(
	firstTargetToken: Token.Implementation | null | undefined,
): IncomingAttackPlan {
	const plan: IncomingAttackPlan = {
		disadvantageCount: 0,
		forceMiss: false,
		appliedEntries: [],
		reactionEntries: [],
		autoRerollEntries: [],
	};

	if (!firstTargetToken?.actor) return plan;

	const targetActor = firstTargetToken.actor as unknown as ActorLike;
	const targetModifiers = collectTargetIncomingModifiers(targetActor);

	for (const entry of targetModifiers) {
		if (entry.modifier === 'disadvantage') {
			plan.disadvantageCount += 1;
			plan.appliedEntries.push(entry);
		} else if (entry.modifier === 'autoMiss') {
			plan.forceMiss = true;
			plan.appliedEntries.push(entry);
		}
	}

	if (plan.forceMiss) return plan;

	const targetActorUuid = (firstTargetToken.actor?.uuid as string) ?? '';
	for (const entry of targetModifiers) {
		if (entry.modifier !== 'forceReroll') continue;
		const reactionEntry: IncomingReactionEntry = {
			id: foundry.utils.randomID(),
			kind: 'forceReroll',
			source: 'rule',
			actorUuid: targetActorUuid,
			tokenUuid: null,
			targetTokenUuid: firstTargetToken.document.uuid,
			label: entry.label,
			ruleId: entry.ruleId,
			itemUuid: entry.itemUuid,
			used: false,
			rerollTrigger: entry.rerollTrigger ?? 'always',
			rerollWithDisadvantage: entry.rerollWithDisadvantage ?? false,
		};
		if (entry.automatic) plan.autoRerollEntries.push(reactionEntry);
		else plan.reactionEntries.push(reactionEntry);
	}

	plan.reactionEntries.push(...collectRedirectCandidates(firstTargetToken));

	return plan;
}

export {
	applyPostRollIncomingBehavior,
	BASELINE_INTERPOSE_RANGE,
	collectRedirectCandidates,
	collectTargetIncomingModifiers,
	computeIncomingAttackPlan,
	withRerollDisadvantage,
	type IncomingAttackModifierEntry,
	type IncomingAttackPlan,
	type IncomingReactionEntry,
	type RerollTrigger,
};
