import type { IncomingReactionEntry } from '#utils/incomingReactionEntry.ts';

import localize from '#utils/localize.js';
import { rerollCostCharges, rerollUsesLeft } from '#utils/rerollCost.js';
import { findRerollRule } from '#utils/rerollEntries.js';

function rerollCost(entry: IncomingReactionEntry, actor: Actor | null): string[] {
	const cost = findRerollRule(entry)?.rerollCost;
	if (!cost || !rerollCostCharges(cost)) return [];

	const parts: string[] = [];
	const usesLeft = rerollUsesLeft(actor, cost);
	if (usesLeft !== null) {
		parts.push(
			localize('NIMBLE.chat.incomingReactions.rerollUsesLeft', { count: String(usesLeft) }),
		);
	}
	if (cost.manaCost > 0) {
		parts.push(localize('NIMBLE.ui.heroicActions.mana', { cost: String(cost.manaCost) }));
	}
	if (cost.woundCost > 0) {
		const key =
			cost.woundCost === 1
				? 'NIMBLE.chat.incomingReactions.costWound'
				: 'NIMBLE.chat.incomingReactions.costWounds';
		parts.push(localize(key, { count: String(cost.woundCost) }));
	}
	if (cost.heroicReaction) {
		parts.push(localize('NIMBLE.chat.incomingReactions.costHeroicReaction'));
	}
	return parts;
}

/**
 * What using a card button costs its actor, for the right side of the button.
 * Empty when the button costs nothing the card knows about.
 */
export function getIncomingReactionCost(entry: IncomingReactionEntry, actor: Actor | null): string {
	if (entry.kind === 'reroll') return rerollCost(entry, actor).join(', ');
	if (entry.kind === 'redirectToSelf' && entry.source === 'baseline') {
		return localize('NIMBLE.chat.incomingReactions.costHeroicReaction');
	}
	return '';
}
