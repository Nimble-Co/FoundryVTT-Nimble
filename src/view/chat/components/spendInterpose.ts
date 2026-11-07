import {
	getHeroicReactionUsageState,
	isSoftBlockedReason,
} from '#utils/incomingReactions/getHeroicReactionUsageState.js';
import type { IncomingReactionEntry } from '#utils/incomingReactions/incomingReactionEntry.ts';
import showReactionConfirmation from '../../../utils/incomingReactions/showReactionConfirmation.js';
import localize from '../../../utils/localize.js';

/**
 * A hero's Interpose costs the Heroic Reaction, also when a rule gives it a
 * longer range (Core:492, Core:512). A rule Interpose of a monster is free.
 */
export function paysForInterpose(
	entry: IncomingReactionEntry,
	actor?: { type?: string } | null,
): boolean {
	if (entry.kind !== 'redirectToSelf') return false;
	if (entry.source === 'baseline') return true;
	const owner =
		actor !== undefined
			? actor
			: entry.actorUuid
				? (fromUuidSync(entry.actorUuid) as { type?: string } | null)
				: null;
	return owner?.type === 'character';
}

/**
 * Spend the Interpose through the combat's reaction bookkeeping (with the
 * usual already-spent confirmation) before relaying the redirect. Outside
 * combat there is nothing to spend. With `force`, the caller has already
 * confirmed a bent limit.
 */
export async function spendInterpose(
	entry: IncomingReactionEntry,
	options: { force?: boolean } = {},
): Promise<boolean> {
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
	if (options.force) {
		return combat.useHeroicReactions(combatant.id, ['interpose'], { force: true });
	}

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
