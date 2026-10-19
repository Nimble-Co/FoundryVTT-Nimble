import { isResourceSpendingAutomationEnabled } from '../settings/automationSettings.js';
import { getHeroicReactionUsageState, isSoftBlockedReason } from './getHeroicReactionUsageState.js';
import { getHeroicReactionLabel } from './heroicActions.js';
import type { IncomingReactionEntry } from './incomingReactionEntry.js';
import { findActorCombatant } from './rerollCost.js';
import { findRerollRule } from './rerollEntries.js';
import showReactionConfirmation from './showReactionConfirmation.js';

/**
 * Ask the player, on their own client, before a reroll uses a heroic reaction
 * the combat would normally refuse (already spent, no actions left, or their
 * own turn). Resolves true when they confirm, null when they cancel, and false
 * when no question is needed.
 */
export async function confirmRerollHeroicReaction(
	entry: IncomingReactionEntry,
): Promise<boolean | null> {
	const key = findRerollRule(entry)?.rerollCost?.heroicReaction;
	if (!key || !isResourceSpendingAutomationEnabled()) return false;

	const actor = fromUuidSync(entry.actorUuid as `Actor.${string}`) as Actor | null;
	const found = findActorCombatant(actor);
	if (!found) return false;

	const usage = getHeroicReactionUsageState({
		combat: game.combat ?? null,
		combatant: found.combatant as Combatant.Implementation,
		reactionKeys: [key],
	});
	if (usage.canUse || !isSoftBlockedReason(usage.blockedReason)) return false;

	const reactionName = getHeroicReactionLabel(key);
	const confirmed = await showReactionConfirmation({
		reactionName,
		spentReactionNames: reactionName,
		noActions: usage.blockedReason === 'noActions',
		hasSpentReactions: usage.blockedReason === 'spent',
		isActiveTurn: usage.blockedReason === 'activeTurn',
	});
	return confirmed ? true : null;
}
