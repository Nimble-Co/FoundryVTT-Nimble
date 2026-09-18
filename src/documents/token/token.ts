import type { MovementOffer } from '#types/movement.js';
import localize from '../../utils/localize.js';
import { findArmedMovementOffer } from '../../utils/movement/findArmedMovementOffer.js';
import {
	FORCED_MOVEMENT_ACTION,
	FREE_MOVEMENT_ACTION,
} from '../../utils/movement/movementActions.js';
import {
	type MeasuredMovement,
	movementOfferConstraints,
} from '../../utils/movement/movementOfferConstraints.js';

interface ConstrainOptions {
	ignoreWalls?: boolean;
	ignoreCost?: boolean;
	maxDistance?: number;
	maxCost?: number;
}

interface DropUpdateOptions {
	constrainOptions?: ConstrainOptions;
	[key: string]: unknown;
}

/** The token layer state a drag reads. Neither field is declared by fvtt-types. */
interface DraggingLayer {
	/** Set when the user picked a movement action for this drag with the cycle key. */
	_dragMovementAction?: string | null;
	_draggedToken?: {
		mouseInteractionManager?: {
			interactionData?: { contexts?: Record<string, { unreachableWaypoints: readonly unknown[] }> };
		};
	} | null;
}

/**
 * A token that carries a Movement Offer drags under that offer: the ruler
 * stops at the offered distance and the Movement is labelled Free Move or
 * Forced Movement, so the offer needs no button anywhere.
 *
 * The offer never takes the drag over. Whoever owns the token still chooses
 * the path and the final space, may drop short, and may set the offer aside by
 * picking another movement action for the drag.
 */
export class NimbleToken extends foundry.canvas.placeables.Token {
	/**
	 * Looked up on demand rather than cached for the drag: core asks for the
	 * drag options again on every pointer move, but the lookup only walks the
	 * recent chat log, and a cache would outlive the offer it stands for.
	 */
	#offer(): MovementOffer | null {
		const uuid = this.document.uuid;
		return uuid ? (findArmedMovementOffer(uuid)?.offer ?? null) : null;
	}

	#layer(): DraggingLayer {
		return this.layer as unknown as DraggingLayer;
	}

	/**
	 * The offer applies unless the GM turned constrained movement off, or the
	 * user picked a movement action for this drag themselves.
	 */
	#appliedOffer(base: ConstrainOptions): MovementOffer | null {
		// Both flags come from the core Unconstrained Movement setting, which a
		// GM uses precisely to put a token wherever they want.
		if (base.ignoreWalls && base.ignoreCost) return null;
		if (this.#layer()._dragMovementAction) return null;
		return this.#offer();
	}

	#gridDistance(): number {
		return this.document.parent?.grid?.distance ?? 0;
	}

	/** What this token has already moved, as core measures it when a drag is dropped. */
	#movedSoFar(): MeasuredMovement {
		const history = this.document.movementHistory;
		if (!history.length) return { distance: 0, cost: 0 };
		const measured = this.document.measureMovementPath(history) as Partial<MeasuredMovement>;
		return { distance: measured.distance ?? 0, cost: measured.cost ?? 0 };
	}

	#isDropUnreachable(): boolean {
		const id = this.document.id;
		if (!id) return false;
		const contexts =
			this.#layer()._draggedToken?.mouseInteractionManager?.interactionData?.contexts;
		return (contexts?.[id]?.unreachableWaypoints.length ?? 0) > 0;
	}

	/**
	 * Limits the drag preview, which core measures from the drag's own origin.
	 * The ruler stops at the offered distance and the rest of the path is drawn
	 * as unreachable.
	 */
	_getDragConstrainOptions(): ConstrainOptions {
		// @ts-expect-error - fvtt-types does not declare the v14 drag option seams
		const base = super._getDragConstrainOptions() as ConstrainOptions;
		const offer = this.#appliedOffer(base);
		const gridDistance = this.#gridDistance();
		if (!offer || !gridDistance) return base;
		return { ...base, ...movementOfferConstraints(offer, gridDistance, null) };
	}

	/**
	 * Limits the drop, which core measures across the Movement history and the
	 * new path together, so this limit has to carry what the token already moved.
	 */
	_getDragLeftDropUpdateOptions(): DropUpdateOptions {
		// @ts-expect-error - fvtt-types does not declare the v14 drag option seams
		const options = super._getDragLeftDropUpdateOptions() as DropUpdateOptions;
		const base = options.constrainOptions ?? {};
		const offer = this.#appliedOffer(base);
		const gridDistance = this.#gridDistance();
		if (!offer || !gridDistance) return options;
		options.constrainOptions = {
			...base,
			...movementOfferConstraints(offer, gridDistance, this.#movedSoFar()),
		};
		return options;
	}

	/** Labels the drag, so an offered Movement never draws on the creature's own speed. */
	_getDragMovementAction(): string {
		const offer = this.#layer()._dragMovementAction ? null : this.#offer();
		// @ts-expect-error - fvtt-types does not declare the v14 drag option seams
		if (!offer) return super._getDragMovementAction() as string;
		return offer.kind === 'forced' ? FORCED_MOVEMENT_ACTION : FREE_MOVEMENT_ACTION;
	}

	/**
	 * Refuses a drop past the offered distance. Core would otherwise truncate
	 * the path to the origin and move nothing at all, without saying why. The
	 * drag stays open, so the next drop inside the offer lands.
	 */
	_shouldPreventDragLeftDrop(event: Canvas.Event.Pointer): boolean {
		// @ts-expect-error - fvtt-types does not declare the v14 drag option seams
		if (super._shouldPreventDragLeftDrop(event) as boolean) return true;

		// @ts-expect-error - fvtt-types does not declare the v14 drag option seams
		const offer = this.#appliedOffer(super._getDragConstrainOptions() as ConstrainOptions);
		if (!offer || !this.#isDropUnreachable()) return false;

		ui.notifications?.warn(
			localize('NIMBLE.movement.offers.tooFar', {
				name: this.document.name,
				spaces: String(offer.spaces),
				label: offer.label,
			}),
		);
		return true;
	}
}
