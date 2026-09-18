import type { MoveNode } from '#types/effectTree.js';
import { isMovementOffersAutomationEnabled } from '../../settings/automationSettings.js';
import { flattenEffectsTree } from '../treeManipulation/flattenEffectsTree.js';
import {
	buildCardMovementOffer,
	type CardMovementOffer,
	type OfferMessage,
} from './buildCardMovementOffer.js';

/**
 * How far back through the chat log an offer is looked for. An offer stands
 * until it is resolved, like the other card offers, so this is only a bound on
 * the work done per drag.
 */
const MESSAGE_LOOKBACK = 30;

/**
 * The Movement Offer a token is carrying, or null when it is carrying none.
 *
 * Newest first, so a second push supersedes an unresolved first one. An offer
 * whose entry is already recorded is spent, and an offer of no distance is not
 * an offer.
 */
export function findArmedMovementOffer(
	tokenUuid: string,
	deps: { messages?: readonly OfferMessage[]; enabled?: boolean } = {},
): CardMovementOffer | null {
	const enabled = deps.enabled ?? isMovementOffersAutomationEnabled();
	if (!enabled || !tokenUuid) return null;

	const messages =
		deps.messages ??
		((game.messages?.contents.slice(-MESSAGE_LOOKBACK) ?? []) as unknown as OfferMessage[]);

	for (let index = messages.length - 1; index >= 0; index--) {
		const message = messages[index];
		if (!message?.id) continue;
		const effects = message.system?.activation?.effects;
		if (!effects?.length) continue;

		const moveNodes = flattenEffectsTree(effects).filter(
			(node): node is MoveNode => node.type === 'move',
		);
		for (const node of moveNodes) {
			const card = buildCardMovementOffer(
				{ messageId: message.id, nodeId: node.id, tokenUuid },
				{ message },
			);
			if (!card || card.entry?.used || card.offer.spaces < 1) continue;
			return card;
		}
	}

	return null;
}
