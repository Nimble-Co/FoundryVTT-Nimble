type CanvasDragPanCapable = {
	_onDragCanvasPan(event: PIXI.FederatedPointerEvent): void;
};

function isCanvasDragPanCapable(value: object): value is CanvasDragPanCapable {
	return '_onDragCanvasPan' in value;
}

/**
 * Call Foundry's internal canvas edge-pan handler.
 *
 * This uses a type guard to narrow the global `canvas` to a structural type that exposes the method,
 * avoiding `as object as ...` at the call site. Note that this does not change the runtime object.
 */
export function canvasDragPan(event: PIXI.FederatedPointerEvent): void {
	// Assign to `object` so we don't inherit `protected` members from the `Canvas` type.
	const maybeCanvas: object = canvas;
	if (!isCanvasDragPanCapable(maybeCanvas)) return;

	// We intentionally call the internal method with the Pixi federated event, since this is what our handlers receive.
	maybeCanvas._onDragCanvasPan(event);
}
