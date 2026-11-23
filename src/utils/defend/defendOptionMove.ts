import type { DefendOptionRule } from '../../models/rules/defendOption.js';
import { isMovementOffersAutomationEnabled } from '../../settings/automationSettings.js';
import { findActorToken } from '../movement/findActorToken.js';
import { offerMovement } from '../movement/postMovementOfferCard.js';

/**
 * Offers each taken Defend Option's free move on the attack card. The player
 * chooses where to stop. Skipping the drag leaves the Defend as it was written.
 * Returns whether any creature got an offer.
 */
export async function offerDefendOptionMoves(input: {
	rules: readonly DefendOptionRule[];
	actor: Actor.Implementation;
	tokenUuid?: string | null;
	fromName: string;
	card: ChatMessage | null;
}): Promise<boolean> {
	const moves = input.rules.flatMap((rule) => {
		const offer = rule.moveOffer();
		return offer ? [{ rule, offer }] : [];
	});
	if (moves.length === 0 || !isMovementOffersAutomationEnabled()) return false;

	const token = moverToken(input.actor, input.tokenUuid);
	if (!token?.uuid) return false;

	const sourceName = input.fromName.trim();
	let offered = false;
	for (const { rule, offer } of moves) {
		const name = rule.label || rule.parentDocument.name;
		const posted = await offerMovement(
			{
				actor: input.actor,
				token,
				name,
				image: rule.parentDocument.img || undefined,
				reason: name,
				node: {
					kind: 'free',
					distance: offer.distance,
					direction: offer.direction,
					ignoreDifficultTerrain: false,
					...(sourceName ? { sourceName } : {}),
				},
				recipients: [token.uuid],
				whisper: false,
			},
			input.card ? { card: input.card } : null,
		);
		offered ||= posted;
	}
	return offered;
}

function moverToken(
	actor: Actor.Implementation,
	tokenUuid: string | null | undefined,
): TokenDocument | null {
	if (tokenUuid) {
		const document = fromUuidSync(tokenUuid) as TokenDocument | null;
		if (document?.uuid) return document;
	}
	return findActorToken(actor);
}
