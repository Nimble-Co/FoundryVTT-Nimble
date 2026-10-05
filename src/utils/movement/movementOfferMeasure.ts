import type { MovementOffer } from '#types/movement.js';

export type MovementOfferMeasure = 'cost' | 'distance';

/**
 * What the spaces of a Movement Offer are counted in. Difficult terrain doubles
 * cost, not distance, so a Free Move that honours it is counted by cost. Forced
 * Movement and a Free Move that ignores difficult terrain are counted by
 * distance. The ruler and the card both read this, so they agree.
 */
export function movementOfferMeasure(
	offer: Pick<MovementOffer, 'kind' | 'ignoreDifficultTerrain'>,
): MovementOfferMeasure {
	return offer.kind === 'free' && !offer.ignoreDifficultTerrain ? 'cost' : 'distance';
}
