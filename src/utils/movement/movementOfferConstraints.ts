import type { MovementOffer } from '#types/movement.js';

/** What a measured path has already used up, in scene units. */
export interface MeasuredMovement {
	distance: number;
	cost: number;
}

/**
 * The limit Foundry should apply to a drag of a token that carries this offer.
 *
 * Cost doubles in difficult terrain and distance does not, so a Free Move that
 * honours terrain is capped by cost and every other offer by distance.
 *
 * `used` is the movement already recorded for the turn. Pass it for the drop,
 * where core measures the history and the new path together, and leave it null
 * for the drag preview, where core measures from the drag's own origin.
 */
export function movementOfferConstraints(
	offer: Pick<MovementOffer, 'kind' | 'spaces' | 'ignoreDifficultTerrain'>,
	gridDistance: number,
	used: MeasuredMovement | null,
): { maxDistance?: number; maxCost?: number } {
	const limit = Math.max(0, offer.spaces) * gridDistance;
	if (offer.kind === 'free' && !offer.ignoreDifficultTerrain) {
		return { maxCost: limit + (used?.cost ?? 0) };
	}
	return { maxDistance: limit + (used?.distance ?? 0) };
}
