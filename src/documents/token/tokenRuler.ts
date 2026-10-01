import type { OfferRulerWaypoint } from '#types/movement.js';
import { markWaypointsPastOffer } from '#utils/movement/markWaypointsPastOffer.js';
import { findArmedMovementOffer } from '#utils/movement/movementOffers.js';

/** Core dashes the line from the first drawn waypoint out of reach, so the last one in reach must be drawn. */
function endsReach(waypoint: unknown): boolean {
	const { unreachable, next } = waypoint as {
		unreachable: boolean;
		next?: { unreachable: boolean } | null;
	};
	return !unreachable && !!next?.unreachable;
}

/**
 * Shows how far a Movement Offer reaches while its token is dragged: the part
 * of the drag past the offer is drawn the way core draws an unreachable path.
 */
export class NimbleTokenRuler extends foundry.canvas.placeables.tokens.TokenRuler {
	protected override _preparePath(
		path: foundry.canvas.placeables.tokens.TokenRuler.Waypoint[],
	): void {
		super._preparePath(path);
		const document = this.token.document;
		const gridDistance = document.parent?.grid?.distance ?? 0;
		const offer = document.uuid ? findArmedMovementOffer(document.uuid) : null;
		if (!offer || !gridDistance) return;
		markWaypointsPastOffer(path as unknown as OfferRulerWaypoint[], offer, gridDistance);
	}

	protected override _shouldRenderWaypoint(
		waypoint: Parameters<foundry.canvas.placeables.tokens.TokenRuler['_shouldRenderWaypoint']>[0],
	): boolean {
		return super._shouldRenderWaypoint(waypoint) || endsReach(waypoint);
	}
}
