import {
	getHeroicReactionUsageState,
	isSoftBlockedReason,
} from '#utils/incomingReactions/getHeroicReactionUsageState.js';
import type { IncomingReactionEntry } from '#utils/incomingReactions/incomingReactionEntry.ts';
import showReactionConfirmation from '../../../utils/incomingReactions/showReactionConfirmation.js';
import localize from '../../../utils/localize.js';

/**
 * Baseline Interpose costs the standard heroic reaction; spend it through
 * the combat's reaction bookkeeping (with the usual already-spent
 * confirmation) before relaying the redirect. Rule-granted offers leave
 * their cost to the granting feature. Outside combat there is nothing to
 * spend.
 */
export async function spendBaselineInterpose(entry: IncomingReactionEntry): Promise<boolean> {
	const combat = game.combat as
		| (Combat & {
				useHeroicReactions?: (
					combatantId: string,
					reactionKeys: string[],
					options?: { force?: boolean },
				) => Promise<boolean>;
		  })
		| null;
	if (!combat?.started || !combat.useHeroicReactions) return true;

	const tokenDoc = entry.tokenUuid
		? (fromUuidSync(entry.tokenUuid) as TokenDocument.Implementation | null)
		: null;
	const combatant = tokenDoc
		? (combat.combatants.find((c) => c.tokenId === tokenDoc.id) ?? null)
		: null;
	if (!combatant?.id) return true;

	const used = await combat.useHeroicReactions(combatant.id, ['interpose']);
	if (used) return true;

	const usageState = getHeroicReactionUsageState({
		combat,
		combatant,
		reactionKeys: ['interpose'],
	});
	if (!isSoftBlockedReason(usageState.blockedReason)) return false;

	const confirmed = await showReactionConfirmation({
		reactionName: localize('NIMBLE.ui.heroicActions.reactionLabels.interpose'),
		spentReactionNames: localize('NIMBLE.ui.heroicActions.reactionLabels.interpose'),
		noActions: usageState.blockedReason === 'noActions',
		hasSpentReactions: usageState.blockedReason === 'spent',
		isActiveTurn: usageState.blockedReason === 'activeTurn',
	});
	if (!confirmed) return false;

	return combat.useHeroicReactions(combatant.id, ['interpose'], { force: true });
}
