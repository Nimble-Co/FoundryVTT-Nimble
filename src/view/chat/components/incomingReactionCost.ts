import { costUsesLeft, type UseCost, useCostCharges } from '#utils/cost/useCost.js';
import type { IncomingReactionEntry } from '#utils/incomingReactions/incomingReactionEntry.ts';
import localize from '#utils/localize.js';
import { findRerollRule } from '#utils/reroll/rerollEntries.js';
import { isResourceSpendingAutomationEnabled } from '../../../settings/automationSettings.js';

/** What a cost takes from its actor, as short parts for one line. */
export function useCostParts(cost: UseCost | null | undefined, actor: Actor | null): string[] {
	if (!cost || !useCostCharges(cost)) return [];
	if (!isResourceSpendingAutomationEnabled()) {
		return cost.heroicReaction
			? [localize('NIMBLE.chat.incomingReactions.costHeroicReaction')]
			: [];
	}

	const parts: string[] = [];
	const usesLeft = costUsesLeft(actor, cost);
	if (usesLeft !== null) {
		parts.push(localize('NIMBLE.chat.incomingReactions.costUsesLeft', { count: String(usesLeft) }));
	}
	if (cost.manaCost > 0) {
		parts.push(
			cost.perDie
				? localize('NIMBLE.chat.incomingReactions.costManaPerDie', { cost: String(cost.manaCost) })
				: localize('NIMBLE.ui.heroicActions.mana', { cost: String(cost.manaCost) }),
		);
	}
	if (cost.woundCost > 0) {
		const key =
			cost.woundCost === 1
				? 'NIMBLE.chat.incomingReactions.costWound'
				: 'NIMBLE.chat.incomingReactions.costWounds';
		parts.push(localize(key, { count: String(cost.woundCost) }));
	}
	if ((cost.actionCost ?? 0) > 0) {
		parts.push(localize('NIMBLE.chat.incomingReactions.costAction'));
	}
	if (cost.turnUseKey) {
		parts.push(localize('NIMBLE.chat.incomingReactions.costOncePerTurn'));
	}
	if (cost.heroicReaction) {
		parts.push(localize('NIMBLE.chat.incomingReactions.costHeroicReaction'));
	}
	return parts;
}

/**
 * What using a row of Change This Roll costs its actor, for the right side of the row.
 * Empty when the row costs nothing the card knows about.
 */
export function getIncomingReactionCost(entry: IncomingReactionEntry, actor: Actor | null): string {
	if (entry.kind === 'reroll') {
		return useCostParts(findRerollRule(entry)?.rollUseCost, actor).join(', ');
	}
	if (entry.kind === 'redirectToSelf') {
		return localize('NIMBLE.chat.incomingReactions.costHeroicReaction');
	}
	return '';
}
