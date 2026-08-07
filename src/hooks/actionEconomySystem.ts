import { SYSTEM_ID, systemHookName } from '#system';
import { buildActionDeltaSummary } from '#utils/actionDeltaSummary.js';
import { collectGrantedActionOffers } from '#utils/grantedActionOffers.js';
import { isCombatantDead } from '#utils/isCombatantDead.js';
import { requestCombatantActionDelta } from '#utils/requestCombatantActionDelta.js';
import type { ActionDeltaApplication, ActionDeltaRule } from '../models/rules/actionDelta.js';

type HookFn = (...args: unknown[]) => unknown;

interface UseItemTarget {
	id?: string | null;
	document?: { id?: string | null } | null;
	actor?: { id?: string | null; uuid?: string } | null;
}

interface UseItemContext {
	targets?: UseItemTarget[];
}

interface RuleBearingItem {
	uuid?: string;
	name?: string;
	isEmbedded?: boolean;
	actor?: { id?: string | null; uuid?: string } | null;
	rules?: Map<string, { type?: string }> | null;
}

function registerCustomHook(eventName: string, fn: HookFn): void {
	(Hooks.on as (event: string, fn: HookFn) => number)(eventName, fn);
}

function toRuleBearingItem(item: unknown): RuleBearingItem | null {
	if (!item || typeof item !== 'object') return null;
	const typedItem = item as RuleBearingItem;
	if (!typedItem.isEmbedded || !typedItem.actor) return null;
	return typedItem;
}

function getActionDeltaRules(item: RuleBearingItem): ActionDeltaRule[] {
	const rules = item.rules;
	if (!rules || typeof rules.values !== 'function') return [];
	return [...rules.values()].filter(
		(rule): rule is ActionDeltaRule =>
			rule?.type === 'actionDelta' && (rule as ActionDeltaRule).appliesTo(),
	);
}

function getCombatantDisposition(combatant: Combatant.Implementation): number | null {
	const disposition = Number(
		combatant.token?.disposition ?? combatant.token?.object?.document?.disposition ?? Number.NaN,
	);
	return Number.isFinite(disposition) ? disposition : null;
}

function findCombatantForActorId(
	combat: Combat,
	actorId: string | null | undefined,
): Combatant.Implementation | null {
	if (!actorId) return null;
	return combat.combatants.find((combatant) => combatant.actorId === actorId) ?? null;
}

function findCombatantForTarget(
	combat: Combat,
	target: UseItemTarget,
): Combatant.Implementation | null {
	const tokenId = target.document?.id ?? target.id ?? null;
	if (tokenId) {
		const tokenCombatant =
			combat.combatants.find((combatant) => combatant.tokenId === tokenId) ?? null;
		if (tokenCombatant) return tokenCombatant;
	}
	return findCombatantForActorId(combat, target.actor?.id ?? null);
}

/**
 * The living character combatants a rule affects, per its `target` field:
 * the activating actor's combatant, the user's current targets, or every
 * OTHER character combatant sharing the source's token disposition.
 *
 * The all-allies branch excludes the source: an ally is a friendly creature
 * other than yourself (CoreRules-2), so a feature that benefits "every ally"
 * must not also benefit the character using it. Use `self` alongside it when a
 * rule is meant to cover both.
 *
 * That branch has no distance filter, so it reaches every allied combatant in
 * the encounter regardless of range. Range-limited variants need token
 * adjacency, which the platform does not give us yet.
 */
function resolveTargetCombatants(params: {
	combat: Combat;
	rule: ActionDeltaRule;
	sourceCombatant: Combatant.Implementation | null;
	targets: UseItemTarget[];
}): Combatant.Implementation[] {
	const { combat, rule, sourceCombatant, targets } = params;

	let candidates: Array<Combatant.Implementation | null>;
	if (rule.target === 'self') {
		candidates = [sourceCombatant];
	} else if (rule.target === 'targeted') {
		candidates = targets.map((target) => findCombatantForTarget(combat, target));
	} else {
		const sourceDisposition = sourceCombatant ? getCombatantDisposition(sourceCombatant) : null;
		candidates = combat.combatants.contents.filter(
			(combatant) =>
				combatant.type === 'character' &&
				combatant.id !== sourceCombatant?.id &&
				(sourceDisposition === null || getCombatantDisposition(combatant) === sourceDisposition),
		);
	}

	return candidates.filter(
		(combatant): combatant is Combatant.Implementation =>
			combatant !== null && combatant.type === 'character' && !isCombatantDead(combatant),
	);
}

function accumulateApplication(
	accumulator: Map<string, ActionDeltaApplication>,
	combatantId: string,
	application: ActionDeltaApplication,
): void {
	const existing = accumulator.get(combatantId) ?? { currentDelta: 0, pendingDelta: 0 };
	accumulator.set(combatantId, {
		currentDelta: existing.currentDelta + application.currentDelta,
		pendingDelta: existing.pendingDelta + application.pendingDelta,
	});
}

interface CardMessage {
	system?: { grantedActionOffers?: unknown };
	update?: (data: Record<string, unknown>) => Promise<unknown>;
}

/**
 * Applies the action adjustments declared by the used item's rules. All of an
 * item's adjustments for the same combatant are merged into one combined
 * request so paired current/pending changes land as a single atomic update.
 * Like charge consumption, this runs regardless of the rule-automation setting
 * — it is resource bookkeeping, not condition automation.
 *
 * Returns the summary to record on the activation's chat card, so recipients
 * learn what they were given without having their sheet open. These are the
 * adjustments as REQUESTED: the combatant clamps them and permits overflow when
 * they are written, and the write may be relayed to the active GM
 * asynchronously, so the summary is a record of intent rather than a readback of
 * the resulting pools.
 */
function applyActionDeltas(item: RuleBearingItem, targets: UseItemTarget[]): unknown[] {
	const combat = (game.combat as Combat | null) ?? null;
	if (!combat?.started) return [];

	const rules = getActionDeltaRules(item);
	if (rules.length < 1) return [];

	const sourceCombatant = findCombatantForActorId(combat, item.actor?.id ?? null);

	const applications = new Map<string, ActionDeltaApplication>();
	for (const rule of rules) {
		const application = rule.resolveApplication();
		if (!application) continue;

		for (const combatant of resolveTargetCombatants({ combat, rule, sourceCombatant, targets })) {
			if (!combatant.id) continue;
			accumulateApplication(applications, combatant.id, application);
		}
	}

	// Negative accumulations persist unclamped — the refill and the write path
	// clamp `current` at zero, so a large pending debt simply floors there.
	for (const [combatantId, deltas] of applications) {
		if (deltas.currentDelta === 0 && deltas.pendingDelta === 0) continue;
		void requestCombatantActionDelta({
			combat,
			combatantId,
			sourceItemUuid: item.uuid ?? '',
			deltas,
		});
	}

	return buildActionDeltaSummary(
		applications,
		(combatantId) => combat.combatants.get(combatantId)?.name ?? null,
	);
}

/**
 * The granted-activation offers to stamp onto the used item's chat card, where
 * the recipients' owners (or a GM) can accept them. Unlike the action deltas,
 * this does not require an active combat — an offered activation works
 * anywhere, and any in-combat action cost is resolved by the recipient's normal
 * activation flow.
 */
function collectOffersForCard(
	item: RuleBearingItem,
	targets: UseItemTarget[],
	message: CardMessage | null,
): unknown[] {
	// Only card types whose schema carries the offers field can persist them.
	if (!Array.isArray(message?.system?.grantedActionOffers)) return [];

	return collectGrantedActionOffers(
		item as Parameters<typeof collectGrantedActionOffers>[0],
		targets,
	);
}

/**
 * Resolves an item's action-economy effects and records them on its chat card.
 *
 * Both halves write to the same message, so they share one update rather than
 * racing two concurrent diffs on one document: an item can declare action
 * adjustments and granted activations at once, which makes the overlap the
 * ordinary case rather than a corner one. Runs on the activating client, which
 * authored the message and may therefore update it.
 */
function handleUseItem(item: unknown, chatMessage: unknown, context: unknown): void {
	const typedItem = toRuleBearingItem(item);
	if (!typedItem) return;

	const message = (chatMessage ?? null) as CardMessage | null;
	const targets = ((context as UseItemContext | null)?.targets ?? []).filter(
		(target): target is UseItemTarget => Boolean(target),
	);

	const summary = applyActionDeltas(typedItem, targets);
	const offers = collectOffersForCard(typedItem, targets, message);

	if (!message?.update) return;

	const cardUpdate: Record<string, unknown> = {};
	if (summary.length > 0) cardUpdate[`flags.${SYSTEM_ID}.actionDeltaSummary`] = summary;
	if (offers.length > 0) cardUpdate.system = { grantedActionOffers: offers };
	if (Object.keys(cardUpdate).length < 1) return;

	void message.update(cardUpdate);
}

let didRegisterActionEconomySystemHooks = false;

export { handleUseItem, resolveTargetCombatants };

export default function registerActionEconomySystemHooks(): void {
	if (didRegisterActionEconomySystemHooks) return;
	didRegisterActionEconomySystemHooks = true;

	registerCustomHook(systemHookName('useItem'), handleUseItem as HookFn);
}
