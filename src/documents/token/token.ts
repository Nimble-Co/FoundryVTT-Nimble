import type { MovementOffer } from '#types/movement.js';
import { movementOfferAction } from '../../utils/movement/movementActions.js';
import { findArmedMovementOffer } from '../../utils/movement/movementOffers.js';

interface ConstrainOptions {
	ignoreWalls?: boolean;
	ignoreCost?: boolean;
}

/** Set by core when the user picks a movement action for this drag with the cycle key. */
interface DraggingLayer {
	_dragMovementAction?: string | null;
}

/**
 * A token that carries a Movement Offer drags under that offer: the Movement is
 * labelled Free Move or Forced Movement, and the ruler shows how far the offer
 * reaches. Nothing stops the drag from going further; what the extra spaces
 * mean is for the table to decide.
 */
export class NimbleToken extends foundry.canvas.placeables.Token {
	/**
	 * The offer this drag moves under. The user sets it aside by picking another
	 * movement action for the drag, and the GM by turning on core Unconstrained
	 * Movement, which is how a GM puts a token wherever they want.
	 */
	#dragOffer(): MovementOffer | null {
		if ((this.layer as unknown as DraggingLayer)._dragMovementAction) return null;
		// @ts-expect-error - fvtt-types does not declare the v14 drag option seams
		const base = super._getDragConstrainOptions() as ConstrainOptions;
		if (base.ignoreWalls && base.ignoreCost) return null;
		const uuid = this.document.uuid;
		return uuid ? findArmedMovementOffer(uuid) : null;
	}

	/** Labels the drag, so an offered Movement never draws on the creature's own speed. */
	_getDragMovementAction(): string {
		const offer = this.#dragOffer();
		// @ts-expect-error - fvtt-types does not declare the v14 drag option seams
		if (!offer) return super._getDragMovementAction() as string;
		return movementOfferAction(offer.kind);
	}
}
