import { systemHookName } from '#system';
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
 * character combatant sharing the source's token disposition.
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

/**
 * Applies the action adjustments declared by the used item's rules. All of an
 * item's adjustments for the same combatant are merged into one combined
 * request so paired current/pending changes land as a single atomic update.
 * Like charge consumption, this runs regardless of the rule-automation setting
 * — it is resource bookkeeping, not condition automation.
 */
function handleUseItem(item: unknown, _chatMessage: unknown, context: unknown): void {
	const typedItem = toRuleBearingItem(item);
	if (!typedItem) return;

	const combat = (game.combat as Combat | null) ?? null;
	if (!combat?.started) return;

	const rules = getActionDeltaRules(typedItem);
	if (rules.length < 1) return;

	const targets = ((context as UseItemContext | null)?.targets ?? []).filter(
		(target): target is UseItemTarget => Boolean(target),
	);
	const sourceCombatant = findCombatantForActorId(combat, typedItem.actor?.id ?? null);

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
			sourceItemUuid: typedItem.uuid ?? '',
			deltas,
		});
	}
}

/**
 * Stamps the used item's granted-activation offers onto its chat card, where
 * the recipients' owners (or a GM) can accept them. Runs on the activating
 * client, which authored the message and may therefore update it. Unlike the
 * action-delta handler, this does not require an active combat — an offered
 * activation works anywhere, and any in-combat action cost is resolved by the
 * recipient's normal activation flow.
 */
function handleUseItemGrantedOffers(item: unknown, chatMessage: unknown, context: unknown): void {
	const typedItem = toRuleBearingItem(item);
	if (!typedItem) return;

	const message = chatMessage as {
		system?: { grantedActionOffers?: unknown };
		update?: (data: Record<string, unknown>) => Promise<unknown>;
	} | null;
	// Only card types whose schema carries the offers field can persist them.
	if (!message?.update || !Array.isArray(message.system?.grantedActionOffers)) return;

	const targets = ((context as UseItemContext | null)?.targets ?? []).filter(
		(target): target is UseItemTarget => Boolean(target),
	);
	const offers = collectGrantedActionOffers(
		typedItem as Parameters<typeof collectGrantedActionOffers>[0],
		targets,
	);
	if (offers.length < 1) return;

	void message.update({ system: { grantedActionOffers: offers } });
}

let didRegisterActionEconomySystemHooks = false;

export default function registerActionEconomySystemHooks(): void {
	if (didRegisterActionEconomySystemHooks) return;
	didRegisterActionEconomySystemHooks = true;

	registerCustomHook(systemHookName('useItem'), handleUseItem as HookFn);
	registerCustomHook(systemHookName('useItem'), handleUseItemGrantedOffers as HookFn);
}
