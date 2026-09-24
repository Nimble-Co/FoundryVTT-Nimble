import { findArmedMovementOffer } from '../../utils/movement/findArmedMovementOffer.js';
import {
	markWaypointsPastOffer,
	type OfferRulerWaypoint,
} from '../../utils/movement/markWaypointsPastOffer.js';

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
		const offer = document.uuid ? findArmedMovementOffer(document.uuid)?.offer : null;
		if (!offer || !gridDistance) return;
		markWaypointsPastOffer(path as unknown as OfferRulerWaypoint[], offer, gridDistance);
	}
}
