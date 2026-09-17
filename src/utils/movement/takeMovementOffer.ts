import type { MovementOfferOutcome, MovementOfferRef } from '#types/movement.js';
import localize from '../localize.js';
import { buildCardMovementOffer } from './buildCardMovementOffer.js';
import { requestMovementOfferStamp } from './movementOfferRelay.js';
import { requestMove } from './requestMove.js';

/**
 * Takes a Movement Offer from a card's `move` node for one recipient token:
 * offers the drag to whoever should perform it and, once it lands, records on
 * the card how far the token went. The system never moves the token itself.
 */
export async function takeMovementOffer(ref: MovementOfferRef): Promise<MovementOfferOutcome> {
	const result = await requestMove(ref);
	if (result.outcome === 'started') {
		await requestMovementOfferStamp(ref, {
			movedSpaces: result.movedSpaces,
			stopped: result.stopped,
		});
	} else if (result.outcome === 'unavailable') {
		const name = buildCardMovementOffer(ref)?.token.name ?? '';
		ui.notifications?.warn(localize('NIMBLE.chat.movementOffers.unavailable', { name }));
	}
	return result.outcome;
}
