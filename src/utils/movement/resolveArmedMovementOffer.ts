import type { MovementOffer, MovementRecord } from '#types/movement.js';
import { getPrimaryActiveGmId } from '../getPrimaryActiveGmId.js';
import { findArmedMovementOffer, settleMovementOffer } from './movementOffers.js';

interface OfferBearingMessage {
	system?: { movementOffers?: MovementOffer[] };
	update?: (changes: Record<string, unknown>) => Promise<unknown>;
}

/**
 * Records on its card what came of a Movement Offer, once the token has
 * finished moving. A Movement of the offered kind is the offer being taken; a
 * Movement of any other kind is the mover going their own way, which leaves the
 * offer unused so a later Movement is not labelled by it. A teleport settles
 * nothing.
 *
 * Runs on the primary active GM, the only client that may write the card.
 */
export async function resolveArmedMovementOffer(record: MovementRecord): Promise<void> {
	if (record.kind === 'teleport') return;
	if (!game.user?.isGM || (game.user.id ?? null) !== getPrimaryActiveGmId()) return;

	const tokenUuid = record.token?.uuid;
	if (!tokenUuid) return;
	const armed = findArmedMovementOffer(tokenUuid);
	if (!armed) return;

	const message = game.messages?.get(armed.messageId) as OfferBearingMessage | undefined;
	if (!message?.update) return;

	const offers = settleMovementOffer(message.system?.movementOffers ?? [], armed.id, {
		taken: record.kind === armed.kind,
		spaces: record.spaces,
		stopped: record.stopped,
		userId: record.user?.id ?? null,
	});
	if (offers) await message.update({ system: { movementOffers: offers } });
}
