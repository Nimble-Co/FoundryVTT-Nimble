import type { MovementOfferTag } from '#types/movement.js';

/**
 * The key a drag under a Movement Offer carries in its `constrainOptions`. Core
 * copies those options to every client with the Movement and reads only the
 * keys it knows, so the offer's name reaches the GM that records it.
 */
export const MOVEMENT_OFFER_TAG_KEY = 'nimbleMovementOffer';

export function withMovementOfferTag<T extends object>(
	constrainOptions: T | undefined,
	tag: MovementOfferTag,
): T & { [MOVEMENT_OFFER_TAG_KEY]: MovementOfferTag } {
	return { ...(constrainOptions ?? ({} as T)), [MOVEMENT_OFFER_TAG_KEY]: tag };
}

export function readMovementOfferTag(constrainOptions: unknown): MovementOfferTag | null {
	const tag = (constrainOptions as Record<string, unknown> | null | undefined)?.[
		MOVEMENT_OFFER_TAG_KEY
	] as Partial<MovementOfferTag> | undefined;
	return typeof tag?.messageId === 'string' && typeof tag.offerId === 'string'
		? { messageId: tag.messageId, offerId: tag.offerId }
		: null;
}
