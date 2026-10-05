import type { ArmedMovementOffer } from '#types/movement.js';
import { cycleOfferedDragAction } from '#utils/movement/cycleOfferedDragAction.js';
import { movementOfferAction } from '#utils/movement/movementActions.js';
import { findArmedMovementOffer } from '#utils/movement/movementOffers.js';
import { tagDragMovements } from '#utils/movement/movementOfferTag.js';

interface ConstrainOptions {
	ignoreWalls?: boolean;
	ignoreCost?: boolean;
}

interface DropOptions {
	constrainOptions?: object;
	movement: Record<string, { constrainOptions?: object }>;
}

interface DropEvent {
	interactionData: { contexts: Record<string, { token: unknown }> };
}

interface SelectableAction {
	canSelect(token: TokenDocument): boolean;
}

interface DraggingLayer {
	/** Set by core when the user picks a movement action for this drag with the cycle key. */
	_dragMovementAction?: string | null;
	_draggedToken?: unknown;
}

/**
 * A token that carries a Movement Offer drags under that offer: the Movement is
 * labelled Free Move or Forced Movement, and the ruler shows how far the offer
 * reaches. Nothing stops the drag from going further; what the extra spaces
 * mean is for the table to decide.
 */
export class NimbleToken extends foundry.canvas.placeables.Token {
	/**
	 * The offer this token's drags can move under: the one it carries, unless the
	 * GM turns on core Unconstrained Movement, which is how a GM puts a token
	 * wherever they want.
	 */
	#availableDragOffer(): ArmedMovementOffer | null {
		// @ts-expect-error - fvtt-types does not declare the v14 drag option seams
		const base = super._getDragConstrainOptions() as ConstrainOptions;
		if (base.ignoreWalls && base.ignoreCost) return null;
		const uuid = this.document.uuid;
		return uuid ? findArmedMovementOffer(uuid) : null;
	}

	/** The offer this drag moves under, unless the user switched the drag to another movement action. */
	#dragOffer(): ArmedMovementOffer | null {
		if ((this.layer as unknown as DraggingLayer)._dragMovementAction) return null;
		return this.#availableDragOffer();
	}

	/** The offer the user can switch this token's current drag to and from with the cycle key, if any. */
	switchableDragOffer(): ArmedMovementOffer | null {
		if ((this.layer as unknown as DraggingLayer)._draggedToken !== this) return null;
		return this.#availableDragOffer();
	}

	/**
	 * The movement action the cycle key switches this token's drag to, where null
	 * is the offered movement. Undefined when there is no offer to cycle with.
	 */
	nextDragAction(reverse = false): string | null | undefined {
		if (!this.switchableDragOffer()) return undefined;
		// The actions core's own cycle goes through for a dragged token.
		const own = this.document.movementAction;
		const actions = Object.entries(
			CONFIG.Token.movement.actions as unknown as Record<string, SelectableAction>,
		)
			.filter(([action, config]) => config.canSelect(this.document) || action === own)
			.map(([action]) => action);
		const current = (this.layer as unknown as DraggingLayer)._dragMovementAction ?? null;
		return cycleOfferedDragAction(actions, current, reverse);
	}

	/** Labels the drag, so an offered Movement never draws on the creature's own speed. */
	_getDragMovementAction(): string {
		const offer = this.#dragOffer();
		// @ts-expect-error - fvtt-types does not declare the v14 drag option seams
		if (!offer) return super._getDragMovementAction() as string;
		return movementOfferAction(offer.kind);
	}

	/**
	 * Names each dragged token's own offer on the drop, so the GM records every
	 * Movement against the offer its token carries.
	 */
	// @ts-expect-error - fvtt-types declares the v13 return; v14 returns [updates, options]
	protected override _prepareDragLeftDropUpdates(event: DropEvent): [object[], DropOptions] {
		const [updates, options] = super._prepareDragLeftDropUpdates(event as never) as unknown as [
			object[],
			DropOptions,
		];
		const { contexts } = event.interactionData;
		const movement = tagDragMovements(options.movement, options.constrainOptions, (id) => {
			const token = contexts[id]?.token;
			const offer = token instanceof NimbleToken ? token.#dragOffer() : null;
			return offer ? { messageId: offer.messageId, offerId: offer.id } : null;
		});
		return [updates, { ...options, movement }];
	}
}
