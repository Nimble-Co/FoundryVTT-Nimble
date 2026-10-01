import { SYSTEM_PATH } from '#system';
import type { OfferRulerWaypoint } from '#types/movement.js';
import localize from '#utils/localize.ts';
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

/** Which offered movement a drag waypoint uses and how many of its spaces. */
function budgetText({ offerBand }: OfferRulerWaypoint): string {
	if (!offerBand) return '';
	return localize(`NIMBLE.movement.ruler.${offerBand.kind}`, {
		spaces: String(offerBand.spaces),
		limit: String(offerBand.limit),
	});
}

/**
 * Shows how far a Movement Offer reaches while its token is dragged: the part
 * of the drag past the offer is drawn the way core draws an unreachable path.
 */
export class NimbleTokenRuler extends foundry.canvas.placeables.tokens.TokenRuler {
	static override WAYPOINT_LABEL_TEMPLATE = `${SYSTEM_PATH}/templates/hud/waypoint-label.hbs`;

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

	protected override _getWaypointLabelContext(
		...args: Parameters<foundry.canvas.placeables.tokens.TokenRuler['_getWaypointLabelContext']>
	): ReturnType<foundry.canvas.placeables.tokens.TokenRuler['_getWaypointLabelContext']> {
		const context = super._getWaypointLabelContext(...args);
		if (!context) return context;
		const budget = budgetText(args[0] as unknown as OfferRulerWaypoint);
		return budget ? Object.assign(context, { budget }) : context;
	}
}
