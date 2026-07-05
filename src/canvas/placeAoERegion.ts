import { SYSTEM_ID } from '#system';
import { canvasDragPan } from '../utils/canvasInternal.js';
import { type AoETemplateConfig, buildAoERegionShape } from './buildAoERegionShape.js';

interface PlaceAoEOptions {
	/** Region name shown on the scene (typically the item name). */
	name: string;
	/** Region color; defaults to the placing user's color. */
	color?: string;
}

interface PreviewListeners {
	move: (event: PIXI.FederatedPointerEvent) => void;
	click: (event: Event) => void;
	cancel: (event: Event) => void;
	wheel: (event: Event) => void;
	wheelAbortController: AbortController;
}

/**
 * Interactively place an area of effect on the current scene as a Region.
 *
 * Shows a pointer-following preview of the configured shape (left-click to
 * place, right-click to cancel, mouse wheel to rotate cones and lines,
 * shift+move for free positioning), then creates a Region document with a
 * grid-conforming V14 region shape.
 *
 * Resolves with the created RegionDocument, or null when cancelled or when
 * the template configuration has no shape.
 */
export async function placeAoERegion(
	template: AoETemplateConfig,
	options: PlaceAoEOptions,
): Promise<RegionDocument | null> {
	if (!template?.shape) return null;
	if (!canvas?.ready || !canvas.scene || !canvas.stage) {
		ui.notifications?.warn('NIMBLE.aoe.noScene', { localize: true });
		return null;
	}

	const scene = canvas.scene;
	const gridSize = scene.grid.size;
	const rotatable = template.shape === 'cone' || template.shape === 'line';

	const preview = new PIXI.Graphics();
	preview.eventMode = 'none';
	canvas.interface?.addChild(preview);

	let position = snapOrigin({ ...canvas.mousePosition });
	let rotation = 0;

	const drawPreview = () => {
		preview.clear();
		preview.lineStyle(3, 0x000000, 0.75);
		preview.beginFill(0xffffff, 0.2);

		const { x, y } = position;
		const radians = Math.toRadians(rotation);

		switch (template.shape) {
			case 'circle':
			case 'emanation': {
				const bonus = template.shape === 'emanation' ? 0.5 : 0;
				preview.drawCircle(x, y, (template.radius + bonus) * gridSize);
				break;
			}
			case 'cone': {
				const length = template.length * gridSize;
				const halfAngle = Math.toRadians(45);
				const left = radians - halfAngle;
				const right = radians + halfAngle;
				preview.moveTo(x, y);
				preview.lineTo(x + Math.cos(left) * length, y + Math.sin(left) * length);
				preview.lineTo(x + Math.cos(right) * length, y + Math.sin(right) * length);
				preview.closePath();
				break;
			}
			case 'line': {
				const length = template.length * gridSize;
				const halfWidth = (template.width * gridSize) / 2;
				const dx = Math.cos(radians);
				const dy = Math.sin(radians);
				// Perpendicular unit vector for the line's width.
				const px = -dy;
				const py = dx;
				preview.drawPolygon([
					x + px * halfWidth,
					y + py * halfWidth,
					x + dx * length + px * halfWidth,
					y + dy * length + py * halfWidth,
					x + dx * length - px * halfWidth,
					y + dy * length - py * halfWidth,
					x - px * halfWidth,
					y - py * halfWidth,
				]);
				break;
			}
			case 'square': {
				const width = template.width * gridSize;
				preview.drawRect(x - width / 2, y - width / 2, width, width);
				break;
			}
		}

		preview.endFill();
	};

	drawPreview();

	return new Promise((resolve) => {
		let lastMove = Date.now();

		const cleanup = () => {
			canvas.stage?.off('mousemove', listeners.move);
			canvas.stage?.off('mousedown', listeners.click);
			canvas.stage?.off('rightdown', listeners.cancel);
			listeners.wheelAbortController.abort();
			preview.destroy();
		};

		const listeners: PreviewListeners = {
			move: (event) => {
				event.stopPropagation();
				const now = Date.now();
				if (now - lastMove <= 30) return;

				canvasDragPan(event);
				const dest = event.getLocalPosition(canvas.stage!);
				position = event.shiftKey ? dest : snapOrigin(dest);
				drawPreview();
				lastMove = now;
			},

			wheel: (event: Event) => {
				if (!(event instanceof WheelEvent)) return;
				if (!rotatable) return;

				event.preventDefault(); // Avoid zooming the browser
				event.stopPropagation();

				const snap = event.shiftKey ? 45 : 15;
				rotation += snap * Math.sign(event.deltaY);
				drawPreview();
			},

			click: (event: Event) => {
				event.stopPropagation();
				cleanup();
				resolve(createRegion());
			},

			cancel: (event: Event) => {
				event.stopPropagation();
				cleanup();
				resolve(null);
			},

			wheelAbortController: new AbortController(),
		};

		canvas.stage?.on('mousemove', listeners.move);
		canvas.stage?.once('mousedown', listeners.click);
		canvas.stage?.once('rightdown', listeners.cancel);
		canvas.app?.view.addEventListener?.('wheel', listeners.wheel, {
			passive: false,
			signal: listeners.wheelAbortController.signal,
		});
	});

	function snapOrigin(point: { x: number; y: number }): { x: number; y: number } {
		const M = CONST.GRID_SNAPPING_MODES;
		return canvas.grid!.getSnappedPoint(point, { mode: M.CENTER | M.VERTEX });
	}

	async function createRegion(): Promise<RegionDocument | null> {
		const shape = buildAoERegionShape(template, {
			origin: position,
			rotation,
			gridSize,
		});
		if (!shape) return null;

		const regionData = {
			name: options.name,
			shapes: [shape],
			color: options.color ?? game.user?.color?.css ?? '#ff6400',
			visibility: CONST.REGION_VISIBILITY.ALWAYS,
			flags: { [SYSTEM_ID]: { aoe: true } },
		} as unknown as RegionDocument.CreateData;

		const [region] = await scene.createEmbeddedDocuments('Region', [regionData]);

		return (region as RegionDocument) ?? null;
	}
}
