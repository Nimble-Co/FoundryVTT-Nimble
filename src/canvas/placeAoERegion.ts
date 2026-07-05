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
 * Shows a pointer-following preview of the exact grid-conformed area the
 * Region will cover (left-click to place, right-click to cancel, mouse wheel
 * to rotate cones and lines in grid-direction steps — hold shift for fine
 * rotation, shift+move for free positioning), then creates a Region document
 * with a grid-conforming V14 region shape.
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

	// The preview renders the same grid-conformed polygons the placed Region
	// will have, computed by core through an unsaved RegionDocument, so what
	// you see is exactly the area that will be covered.
	const drawPreview = () => {
		preview.clear();

		const shape = buildAoERegionShape(template, { origin: position, rotation, gridSize });
		if (!shape) return;

		preview.lineStyle(3, 0x000000, 0.75);
		preview.beginFill(0xffffff, 0.25);

		const RegionClass = getDocumentClass('Region');
		const previewRegion = new RegionClass(
			{ name: 'AoE Preview', shapes: [shape] } as unknown as RegionDocument.CreateData,
			{ parent: scene },
		) as RegionDocument & { polygons: PIXI.Polygon[] };

		for (const polygon of previewRegion.polygons) {
			preview.drawPolygon(polygon.points as unknown as number[]);
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

				// Grid directions by default; shift for fine rotation.
				const snap = event.shiftKey ? 15 : 45;
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

	// Where a shape's origin must sit for its grid-conformed area to cover
	// whole cells: circles span an even number of cells around a vertex,
	// emanations radiate from an occupied cell's center, squares alternate by
	// parity, and cones/lines emanate from a cell edge (its midpoint or a
	// vertex).
	function snapOrigin(point: { x: number; y: number }): { x: number; y: number } {
		if (canvas.grid!.isGridless) return point;
		const M = CONST.GRID_SNAPPING_MODES;

		let mode: number;
		switch (template.shape) {
			case 'circle':
				mode = M.VERTEX;
				break;
			case 'emanation':
				mode = M.CENTER;
				break;
			case 'square':
				mode = template.width % 2 === 0 ? M.VERTEX : M.CENTER;
				break;
			case 'cone':
			case 'line':
				mode = M.VERTEX | M.EDGE_MIDPOINT;
				break;
			default:
				mode = M.CENTER | M.VERTEX;
		}

		return canvas.grid!.getSnappedPoint(point, { mode });
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
