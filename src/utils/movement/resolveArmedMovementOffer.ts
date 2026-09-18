import type { MovementRecord } from '#types/movement.js';
import { getPrimaryActiveGmId } from '../getPrimaryActiveGmId.js';
import { findArmedMovementOffer } from './findArmedMovementOffer.js';
import { type MovementOfferEntry, mergeMovementOfferEntry } from './movementOfferEntry.js';

interface OfferBearingMessage {
	system?: { movementOffers?: MovementOfferEntry[] };
	update?: (changes: Record<string, unknown>) => Promise<unknown>;
}

/**
 * Records on its card what came of a Movement Offer, once the token has
 * finished moving. A Movement of the offered kind is the offer being taken and
 * keeps the spaces the token really covered; a Movement of any other kind is
 * the mover going their own way, which leaves the offer spent and unused so a
 * later Movement is not limited by it. A teleport resolves nothing.
 *
 * Runs on the primary active GM, the only client that may write the card.
 */
export async function resolveArmedMovementOffer(record: MovementRecord): Promise<void> {
	if (record.kind === 'teleport') return;
	if (!game.user?.isGM || (game.user.id ?? null) !== getPrimaryActiveGmId()) return;

	const tokenUuid = record.token?.uuid;
	if (!tokenUuid) return;
	const card = findArmedMovementOffer(tokenUuid);
	if (!card?.offer.messageId) return;

	const message = game.messages?.get(card.offer.messageId) as OfferBearingMessage | undefined;
	if (!message?.update) return;

	const taken = record.kind === card.offer.kind;
	await message.update({
		system: {
			movementOffers: mergeMovementOfferEntry(message.system?.movementOffers ?? [], {
				id: card.offer.id,
				nodeId: card.node.id,
				tokenUuid,
				spaces: card.offer.spaces,
				used: true,
				usedBy: record.user?.id ?? null,
				movedSpaces: taken ? Math.min(record.spaces, card.offer.spaces) : null,
				stopped: taken ? record.stopped : false,
			}),
		},
	});
}
