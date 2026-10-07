import type { MovementOffer, MovementRecord } from '#types/movement.js';
import { isMovementOffersAutomationEnabled } from '../../settings/automationSettings.js';
import { getPrimaryActiveGmId } from '../getPrimaryActiveGmId.js';
import { movementOfferMeasure } from './movementOfferMeasure.js';
import { settleMovementOffer } from './movementOffers.js';
import { queueMovementOfferWrite } from './queueMovementOfferWrite.js';

interface OfferBearingMessage {
	id?: string | null;
	system?: { movementOffers?: MovementOffer[] };
	update?: (changes: Record<string, unknown>) => Promise<unknown>;
}

/**
 * Records on the cards what came of the Movement Offers to a token, once it
 * has finished moving. An offer lasts until the token's next Movement, so that
 * Movement settles every open offer to it: a drag made under an offer names it,
 * and takes it; every other offer is left unused, so an older one cannot label
 * a later Movement. A teleport settles nothing, and a conditional offer is
 * never settled. A taken offer keeps the spaces in the measure its ruler showed.
 *
 * Runs on the primary active GM, the only client that may write the cards.
 * Writes are queued, and each reads its card when its turn comes.
 */
export function resolveArmedMovementOffer(record: MovementRecord): Promise<void> {
	return queueMovementOfferWrite(() => settleOffersTo(record));
}

async function settleOffersTo(record: MovementRecord): Promise<void> {
	if (record.kind === 'teleport') return;
	if (!game.user?.isGM || (game.user.id ?? null) !== getPrimaryActiveGmId()) return;
	if (!record.offer && !isMovementOffersAutomationEnabled()) return;

	const tokenUuid = record.token?.uuid;
	if (!tokenUuid) return;

	const named = record.offer;
	const messages = (game.messages?.contents ?? []) as unknown as OfferBearingMessage[];
	for (const message of messages) {
		const current = message.system?.movementOffers ?? [];
		let offers = current;
		for (const offer of current) {
			if (offer.tokenUuid !== tokenUuid || offer.spaces <= 0) continue;
			const taken = !!named && named.messageId === message.id && named.offerId === offer.id;
			offers =
				settleMovementOffer(offers, offer.id, {
					taken,
					spaces: movementOfferMeasure(offer) === 'cost' ? record.costSpaces : record.spaces,
					stopped: record.stopped,
					userId: record.user?.id ?? null,
				}) ?? offers;
		}
		if (offers !== current && message.update) {
			await message.update({ system: { movementOffers: offers } });
		}
	}
}
