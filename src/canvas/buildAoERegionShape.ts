/**
 * Converts a Nimble item AoE template configuration into a V14 Region shape.
 *
 * Nimble measures areas in grid squares ("spaces", grid distance 1); Region
 * shapes measure in pixels, so every dimension scales by the scene grid size.
 * All shapes are grid-based so the rendered area conforms to the grid metric,
 * matching how Nimble diagrams areas of effect.
 */

export interface AoETemplateConfig {
	shape: 'circle' | 'cone' | 'emanation' | 'line' | 'square' | '';
	length: number;
	radius: number;
	width: number;
}

interface AoEShapeOptions {
	/** Placement origin in scene pixels. */
	origin: { x: number; y: number };
	/** Facing in degrees (cones and lines only). 0 points along +x. */
	rotation?: number;
	/** Scene grid size in pixels per square. */
	gridSize: number;
}

/**
 * Nimble cones fan out from their origin square: a 90-degree flat cone matches
 * the "as wide as it is long" area diagrams used by the rules.
 */
const CONE_ANGLE = 90;

export function buildAoERegionShape(
	template: AoETemplateConfig,
	{ origin, rotation = 0, gridSize }: AoEShapeOptions,
): Record<string, unknown> | null {
	const { shape } = template;

	if (shape === 'circle') {
		return {
			type: 'circle',
			x: origin.x,
			y: origin.y,
			radius: template.radius * gridSize,
			gridBased: true,
		};
	}

	if (shape === 'emanation') {
		// A freely placed emanation approximates a medium (1-square) emitter:
		// the configured radius extends from the edge of the occupied square.
		return {
			type: 'circle',
			x: origin.x,
			y: origin.y,
			radius: (template.radius + 0.5) * gridSize,
			gridBased: true,
		};
	}

	if (shape === 'cone') {
		return {
			type: 'cone',
			x: origin.x,
			y: origin.y,
			radius: template.length * gridSize,
			angle: CONE_ANGLE,
			rotation,
			curvature: 'flat',
			gridBased: true,
		};
	}

	if (shape === 'line') {
		return {
			type: 'line',
			x: origin.x,
			y: origin.y,
			length: template.length * gridSize,
			width: template.width * gridSize,
			rotation,
			gridBased: true,
		};
	}

	if (shape === 'square') {
		return {
			type: 'rectangle',
			x: origin.x,
			y: origin.y,
			width: template.width * gridSize,
			height: template.width * gridSize,
			anchorX: 0.5,
			anchorY: 0.5,
			gridBased: true,
		};
	}

	return null;
}
