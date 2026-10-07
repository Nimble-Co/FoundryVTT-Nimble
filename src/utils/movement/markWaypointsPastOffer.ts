import type { MovementOffer, OfferRulerWaypoint } from '#types/movement.js';
import { movementOfferAction } from './movementActions.js';
import { movementOfferMeasure } from './movementOfferMeasure.js';

/**
 * Marks the part of a planned drag that goes past a Movement Offer, so the ruler
 * draws it the way core draws an unreachable path, and notes how many of the
 * offered spaces each waypoint has used, for the ruler label. Only the drawing
 * changes: the path the token is dropped along is never shortened.
 *
 * Ruler measurements run on from the recorded history, so the distance is
 * counted from the drag's first planned waypoint. Only waypoints labelled with
 * the offer's action are marked, which leaves a drag the user moved under
 * another action alone.
 */
export function markWaypointsPastOffer(
	path: OfferRulerWaypoint[],
	offer: Pick<MovementOffer, 'kind' | 'spaces' | 'ignoreDifficultTerrain'>,
	gridDistance: number,
): void {
	const originIndex = path.findIndex((waypoint) => waypoint.stage === 'planned');
	if (originIndex < 0) return;

	const origin = path[originIndex].measurement;
	const action = movementOfferAction(offer.kind);
	const limit = Math.max(0, offer.spaces) * gridDistance;
	const measure = movementOfferMeasure(offer);

	for (const waypoint of path.slice(originIndex + 1)) {
		if (waypoint.stage !== 'planned' || waypoint.action !== action) continue;
		const used = waypoint.measurement[measure] - origin[measure];
		waypoint.offerBand = {
			kind: offer.kind,
			spaces: Math.round(used / gridDistance),
			limit: Math.max(0, offer.spaces),
		};
		if (used > limit + 1e-6) waypoint.unreachable = true;
	}
}
