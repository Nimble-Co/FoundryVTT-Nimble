import { NimbleToken } from './token.js';

/**
 * While a dragged token carries a Movement Offer, the cycle key (Tab) switches
 * the drag between the offer and the token's own movement, both ways. For any
 * other drag the key keeps core's behaviour.
 */
export class NimbleTokenLayer extends foundry.canvas.layers.TokenLayer {
	override _onCycleViewKey(event: KeyboardEvent): boolean {
		const token = (this as unknown as { _draggedToken?: unknown })._draggedToken;
		// Same guard as core's key handler: a tool with a control is active and no ruler is measuring.
		const tool = ui.controls?.tool as { control?: unknown } | undefined;
		const switchable = tool?.control && !canvas?.controls?.ruler?.active;
		if (!switchable || !(token instanceof NimbleToken) || !token.switchDragBudget()) {
			return super._onCycleViewKey(event);
		}
		this.recalculatePlannedMovementPaths();
		return true;
	}
}
