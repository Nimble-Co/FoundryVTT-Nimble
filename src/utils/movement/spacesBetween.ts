import type { MeasurableGrid, MeasurableTokenDocument, TokenPosition } from '#types/movement.js';

function positionOf(token: MeasurableTokenDocument, override?: TokenPosition): TokenPosition {
	return {
		x: token.x,
		y: token.y,
		elevation: token.elevation,
		width: token.width,
		height: token.height,
		shape: token.shape,
		...override,
	};
}

function gridlessSpaces(a: TokenPosition, b: TokenPosition, grid: MeasurableGrid): number {
	const aw = (a.width ?? 1) * grid.size;
	const ah = (a.height ?? 1) * grid.size;
	const bw = (b.width ?? 1) * grid.size;
	const bh = (b.height ?? 1) * grid.size;
	const overlaps = a.x < b.x + bw && b.x < a.x + aw && a.y < b.y + bh && b.y < a.y + ah;
	if (overlaps) return 0;
	const gapX = Math.max(0, b.x - (a.x + aw), a.x - (b.x + bw));
	const gapY = Math.max(0, b.y - (a.y + ah), a.y - (b.y + bh));
	return Math.max(1, Math.ceil(Math.hypot(gapX, gapY) / grid.size));
}

/**
 * Spaces between two token footprints: 0 when they overlap, 1 when adjacent.
 * On a grid it is the smallest path between any space of one footprint and any
 * space of the other, measured by the scene grid so the world's diagonal rule
 * applies. Gridless scenes measure the edge to edge gap in grid units. A
 * position override measures a token as if it stood there.
 */
export function spacesBetween(
	a: MeasurableTokenDocument,
	b: MeasurableTokenDocument,
	positions?: { a?: TokenPosition; b?: TokenPosition },
): number {
	const grid = a.parent?.grid ?? b.parent?.grid;
	if (!grid) return Number.POSITIVE_INFINITY;

	const positionA = positionOf(a, positions?.a);
	const positionB = positionOf(b, positions?.b);
	if (grid.isGridless) return gridlessSpaces(positionA, positionB, grid);

	const offsetsA = a.getOccupiedGridSpaceOffsets(positionA);
	const offsetsB = b.getOccupiedGridSpaceOffsets(positionB);
	if (offsetsA.length === 0 || offsetsB.length === 0) return Number.POSITIVE_INFINITY;

	let minimum = Number.POSITIVE_INFINITY;
	for (const from of offsetsA) {
		for (const to of offsetsB) {
			if (from.i === to.i && from.j === to.j && (from.k ?? 0) === (to.k ?? 0)) return 0;
			const { spaces } = grid.measurePath([from, to]);
			if (spaces < minimum) minimum = spaces;
		}
	}
	return minimum;
}
