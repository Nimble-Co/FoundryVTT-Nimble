import { NimbleToken } from './token.js';

interface DraggingLayer {
	_draggedToken?: unknown;
	_dragMovementAction: string | null;
	_movementPlanningContext?: { object?: unknown; allowedActions?: string[] | null } | null;
}

/**
 * While a dragged token carries a Movement Offer, the cycle key (Tab) takes the
 * drag round one ring: the offered movement, then each movement action core
 * cycles through, and back to the offer. Shift goes the other way, as in core.
 * For any other drag the key keeps core's behaviour.
 */
export class NimbleTokenLayer extends foundry.canvas.layers.TokenLayer {
	override _onCycleViewKey(event: KeyboardEvent): boolean {
		const layer = this as unknown as DraggingLayer;
		const token = layer._draggedToken;
		// Same guard as core's key handler: a tool with a control is active and no ruler is measuring.
		const tool = ui.controls?.tool as { control?: unknown } | undefined;
		const switchable = tool?.control && !canvas?.controls?.ruler?.active;
		// A planned movement with its own allowed actions never drags under the offer.
		const planned =
			layer._movementPlanningContext?.object === token &&
			!!layer._movementPlanningContext?.allowedActions;
		const next =
			switchable && !planned && token instanceof NimbleToken
				? token.nextDragAction(event.shiftKey)
				: undefined;
		if (next === undefined) return super._onCycleViewKey(event);
		layer._dragMovementAction = next;
		this.recalculatePlannedMovementPaths();
		return true;
	}
}
