import {
	getHeroicReactionUsageState,
	isSoftBlockedReason,
} from '#utils/incomingReactions/getHeroicReactionUsageState.js';
import { getHeroicReactionLabel } from '#utils/incomingReactions/heroicActions.js';
import type { IncomingReactionEntry } from '#utils/incomingReactions/incomingReactionEntry.js';
import showReactionConfirmation from '#utils/incomingReactions/showReactionConfirmation.js';
import { findActorCombatant } from '#utils/reroll/rerollCost.js';
import { findRerollRule } from '#utils/reroll/rerollEntries.js';

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
	if (!key) return false;

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
