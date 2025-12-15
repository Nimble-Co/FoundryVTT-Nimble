interface PreviewListeners {
	move: (event: PIXI.FederatedPointerEvent) => void;
	wheelAbortController: AbortController;
	wheel: (event: Event) => void;
	click: (event: Event) => void;
	cancel: (event: Event) => void;
}

import { canvasDragPan } from '../../utils/canvasInternal.js';

class NimbleTemplateLayer extends foundry.canvas.layers.TemplateLayer {
	#previewListeners: PreviewListeners | null = null;

	async createPreview(data: Record<string, unknown>): Promise<MeasuredTemplate> {
		const initialLayer = canvas.activeLayer;
		const preview = await this._createPreview(
			{ ...data, ...canvas.mousePosition },
			{ renderSheet: false },
		);

		this.#activatePreviewListeners(initialLayer, preview);
		return preview;
	}

	#activatePreviewListeners(
		initialLayer: foundry.canvas.layers.CanvasLayer | null,
		preview: MeasuredTemplate,
	) {
		let lastMove = Date.now();

		const listeners: PreviewListeners = {
			move: (event) => {
				event.stopPropagation();
				const now = Date.now();
				if (now - lastMove <= 30) return;

				canvasDragPan(event);
				const dest = event.getLocalPosition(this);

				if (event.shiftKey) {
					const dx = dest.x - preview.document.x;
					const dy = dest.y - preview.document.y;
					preview.document.updateSource({ x: preview.document.x + dx, y: preview.document.y + dy });
				} else {
					const snapped = canvas.templates?.getSnappedPoint(dest) ?? { x: 0, y: 0 };
					preview.document.updateSource({ x: snapped.x, y: snapped.y });
				}

				preview.renderFlags.set({ refresh: true });
				lastMove = now;
			},

			wheelAbortController: new AbortController(),

			wheel: (event: Event) => {
				if (!(event instanceof WheelEvent)) return;

				event.preventDefault(); // Avoid zooming the browser
				event.stopPropagation();

				const now = Date.now();
				if (now - lastMove <= 10) return;

				const { direction, distance = 1 } = preview.document;

				if (event.ctrlKey) {
					const snap = event.shiftKey || distance <= 6 ? 15 : 5;
					preview.document.updateSource({ direction: direction + snap * Math.sign(event.deltaY) });
				} else if (event.shiftKey) {
					const snap = canvas.grid?.isHexagonal ? 60 : 45;
					preview.document.updateSource({ direction: direction + snap * Math.sign(event.deltaY) });
				} else {
					const snap = canvas.grid!.type > CONST.GRID_TYPES.SQUARE ? 30 : 15;
					preview.document.updateSource({ direction: direction + snap * Math.sign(event.deltaY) });
				}

				preview.renderFlags.set({ refresh: true });
				lastMove = now;
			},

			click: (event: Event) => {
				event.stopPropagation();

				const { document, position } = preview;
				this.#deactivatePreviewListeners(initialLayer);

				document.updateSource(super.getSnappedPoint(position)); // TODO: Make this better
				canvas.scene?.createEmbeddedDocuments('MeasuredTemplate', [document.toObject()]);
			},

			cancel: (event: Event) => {
				event.stopPropagation();
				this.#deactivatePreviewListeners(initialLayer);
			},
		};

		this.#previewListeners = listeners;
		canvas.stage?.on('mousemove', listeners.move);
		canvas.stage?.once('mousedown', listeners.click);
		canvas.stage?.once('rightdown', listeners.cancel);
		canvas.app?.view.addEventListener?.('wheel', listeners.wheel, {
			passive: false,
			signal: listeners.wheelAbortController.signal,
		});
	}

	#deactivatePreviewListeners(initialLayer: foundry.canvas.layers.CanvasLayer | null) {
		if (this.#previewListeners) {
			canvas.stage?.off('mousemove', this.#previewListeners.move);
			canvas.stage?.off('mousedown', this.#previewListeners.click);
			canvas.stage?.off('rightdown', this.#previewListeners.cancel);
			this.#previewListeners.wheelAbortController.abort();
			this.#previewListeners = null;
		}

		if (initialLayer !== this && initialLayer && 'activate' in initialLayer) {
			(initialLayer as foundry.canvas.layers.InteractionLayer).activate();
		}
	}
}

export { NimbleTemplateLayer };
