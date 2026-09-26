import type { MovementOffer } from '#types/movement.js';
import { movementOfferAction } from './movementActions.js';

/** The slice of a core token ruler waypoint this reads and marks. */
export interface OfferRulerWaypoint {
	stage: string;
	action: string;
	unreachable: boolean;
	measurement: { distance: number; cost: number };
}

/**
 * Marks the part of a planned drag that goes past a Movement Offer, so the ruler
 * draws it the way core draws an unreachable path. Only the drawing changes:
 * the path the token is dropped along is never shortened.
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
	// Difficult terrain doubles cost, not distance, so an offer that honours it is measured by cost.
	const byCost = offer.kind === 'free' && !offer.ignoreDifficultTerrain;

	for (const waypoint of path.slice(originIndex + 1)) {
		if (waypoint.stage !== 'planned' || waypoint.action !== action) continue;
		const used = byCost
			? waypoint.measurement.cost - origin.cost
			: waypoint.measurement.distance - origin.distance;
		if (used > limit + 1e-6) waypoint.unreachable = true;
	}
}
