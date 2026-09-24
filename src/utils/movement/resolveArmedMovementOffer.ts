import type { MovementOffer, MovementRecord } from '#types/movement.js';
import { getPrimaryActiveGmId } from '../getPrimaryActiveGmId.js';
import { findArmedMovementOffer, settleMovementOffer } from './movementOffers.js';

interface OfferBearingMessage {
	system?: { movementOffers?: MovementOffer[] };
	update?: (changes: Record<string, unknown>) => Promise<unknown>;
}

/**
 * Records on its card what came of a Movement Offer, once the token has
 * finished moving. A drag made under an offer names it, and takes it. Any other
 * Movement is the mover going their own way, which leaves the offer the token
 * carries unused, so a later Movement is not labelled by it. A teleport settles
 * nothing.
 *
 * Runs on the primary active GM, the only client that may write the card.
 */
export async function resolveArmedMovementOffer(record: MovementRecord): Promise<void> {
	if (record.kind === 'teleport') return;
	if (!game.user?.isGM || (game.user.id ?? null) !== getPrimaryActiveGmId()) return;

	const tokenUuid = record.token?.uuid;
	if (!tokenUuid) return;
	const armed = record.offer ? null : findArmedMovementOffer(tokenUuid);
	const target = record.offer ?? (armed ? { messageId: armed.messageId, offerId: armed.id } : null);
	if (!target) return;

	const message = game.messages?.get(target.messageId) as OfferBearingMessage | undefined;
	const current = message?.system?.movementOffers ?? [];
	const offer = current.find((candidate) => candidate.id === target.offerId);
	if (!message?.update || offer?.tokenUuid !== tokenUuid) return;

	const offers = settleMovementOffer(current, target.offerId, {
		taken: record.offer !== null,
		spaces: record.spaces,
		stopped: record.stopped,
		userId: record.user?.id ?? null,
	});
	if (offers) await message.update({ system: { movementOffers: offers } });
}
