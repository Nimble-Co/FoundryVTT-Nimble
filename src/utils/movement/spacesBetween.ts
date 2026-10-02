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
	// A gap of one full empty space reads 2, as on a grid; the epsilon absorbs float error.
	return 1 + Math.floor(Math.hypot(gapX, gapY) / grid.size + 1e-6);
}

/** A token's width or height in grid spaces, rounded the way core rounds its footprint. */
function footprintSize(size: number | undefined): number {
	return Math.max(Math.round((size ?? 1) * 2) / 2, 0.5);
}

/**
 * The fewest spaces two tokens on a square grid can be apart, from their
 * rectangles alone. No diagonal rule reaches a space in fewer moves than the
 * larger of its row and column distance, and that distance is never less than
 * the gap between the rectangles in whole spaces.
 */
function squareSpacesFloor(a: TokenPosition, b: TokenPosition, size: number): number {
	const gap = (start: number, length: number, otherStart: number, otherLength: number) =>
		Math.max(0, otherStart - (start + length * size), start - (otherStart + otherLength * size));
	const gapX = gap(a.x, footprintSize(a.width), b.x, footprintSize(b.width));
	const gapY = gap(a.y, footprintSize(a.height), b.y, footprintSize(b.height));
	return Math.floor(Math.max(gapX, gapY) / size);
}

/**
 * Spaces between two token footprints: 0 when they overlap, 1 when adjacent.
 * On a grid it is the smallest path between any space of one footprint and any
 * space of the other: the grid's measured distance over the grid distance,
 * rounded, so the world's diagonal rule applies. Gridless scenes count 1 plus
 * the whole grid units in the edge to edge gap. A position override measures
 * a token as if it stood there. A caller that only asks whether two tokens are
 * within `maxSpaces` passes it: on a square grid, tokens whose rectangles are
 * already farther apart return a count above it before core works out their
 * grid spaces.
 */
export function spacesBetween(
	a: MeasurableTokenDocument,
	b: MeasurableTokenDocument,
	positions?: { a?: TokenPosition; b?: TokenPosition },
	maxSpaces = Number.POSITIVE_INFINITY,
): number {
	const grid = a.parent?.grid ?? b.parent?.grid;
	if (!grid) return Number.POSITIVE_INFINITY;

	const positionA = positionOf(a, positions?.a);
	const positionB = positionOf(b, positions?.b);
	if (grid.isGridless) return gridlessSpaces(positionA, positionB, grid);
	if (grid.isSquare) {
		const floor = squareSpacesFloor(positionA, positionB, grid.size);
		if (floor > maxSpaces) return floor;
	}

	const offsetsA = a.getOccupiedGridSpaceOffsets(positionA);
	const offsetsB = b.getOccupiedGridSpaceOffsets(positionB);
	if (offsetsA.length === 0 || offsetsB.length === 0) return Number.POSITIVE_INFINITY;

	let minimum = Number.POSITIVE_INFINITY;
	for (const from of offsetsA) {
		for (const to of offsetsB) {
			if (from.i === to.i && from.j === to.j && (from.k ?? 0) === (to.k ?? 0)) return 0;
			const spaces = Math.round(grid.measurePath([from, to]).distance / grid.distance);
			if (spaces < minimum) minimum = spaces;
		}
	}
	return minimum;
}
