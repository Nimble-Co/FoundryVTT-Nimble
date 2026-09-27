import { describe, expect, it } from 'vitest';
import type { MeasurableTokenDocument } from '#types/movement.js';
import { spacesBetween } from './spacesBetween.js';

const GRID_SIZE = 100;
const GRID_DISTANCE = 5;

type Diagonals =
	| 'equidistant'
	| 'exact'
	| 'approximate'
	| 'rectilinear'
	| 'alternating1'
	| 'alternating2'
	| 'illegal';

/** Mirrors core's square grid measurePath for one 2D move between offsets. */
function measureSquare(diagonals: Diagonals, di: number, dj: number) {
	const [long, short] = di < dj ? [dj, di] : [di, dj];
	let spaces = long;
	let cost: number;
	switch (diagonals) {
		case 'equidistant':
			cost = long;
			break;
		case 'exact':
			cost = long + (Math.SQRT2 - 1) * short;
			break;
		case 'approximate':
			cost = long + 0.5 * short;
			break;
		case 'rectilinear':
			cost = long + short;
			break;
		case 'illegal':
			spaces = long + short;
			cost = spaces;
			break;
		default: {
			const start = diagonals === 'alternating2' ? 1.5 : 0;
			cost = long + Math.floor((start + short) / 2) - Math.floor(start / 2);
		}
	}
	return { spaces, distance: cost * GRID_DISTANCE };
}

function makeGrid(diagonals: Diagonals = 'equidistant', gridless = false) {
	return {
		isGridless: gridless,
		size: GRID_SIZE,
		distance: GRID_DISTANCE,
		measurePath([from, to]: { i: number; j: number }[]) {
			return measureSquare(diagonals, Math.abs(from.i - to.i), Math.abs(from.j - to.j));
		},
	};
}

function makeToken(
	x: number,
	y: number,
	grid: ReturnType<typeof makeGrid>,
	width = 1,
	height = 1,
): MeasurableTokenDocument {
	return {
		x: x * GRID_SIZE,
		y: y * GRID_SIZE,
		width,
		height,
		parent: { grid },
		getOccupiedGridSpaceOffsets(data) {
			const left = Math.floor((data?.x ?? this.x) / GRID_SIZE);
			const top = Math.floor((data?.y ?? this.y) / GRID_SIZE);
			const w = data?.width ?? this.width;
			const h = data?.height ?? this.height;
			const offsets: { i: number; j: number }[] = [];
			for (let i = 0; i < h; i++)
				for (let j = 0; j < w; j++) offsets.push({ i: top + i, j: left + j });
			return offsets;
		},
	};
}

describe('spacesBetween', () => {
	it('is 0 for overlapping footprints and 1 for neighbours', () => {
		const grid = makeGrid();
		expect(spacesBetween(makeToken(0, 0, grid), makeToken(0, 0, grid))).toBe(0);
		expect(spacesBetween(makeToken(0, 0, grid), makeToken(1, 0, grid))).toBe(1);
		expect(spacesBetween(makeToken(0, 0, grid), makeToken(1, 1, grid))).toBe(1);
		expect(spacesBetween(makeToken(0, 0, grid), makeToken(2, 0, grid))).toBe(2);
	});

	it.each([
		['equidistant', 1, 2],
		['illegal', 2, 4],
		['alternating1', 1, 3],
		['alternating2', 2, 3],
		['rectilinear', 2, 4],
		['exact', 1, 3],
		['approximate', 2, 3],
	] as const)('follows the %s diagonal rule', (diagonals, neighbour, twoAway) => {
		const grid = makeGrid(diagonals);
		expect(spacesBetween(makeToken(0, 0, grid), makeToken(1, 0, grid))).toBe(1);
		expect(spacesBetween(makeToken(0, 0, grid), makeToken(1, 1, grid))).toBe(neighbour);
		expect(spacesBetween(makeToken(0, 0, grid), makeToken(2, 2, grid))).toBe(twoAway);
	});

	it('measures large footprints edge to edge, not centre to centre', () => {
		const grid = makeGrid();
		const medium = makeToken(0, 0, grid);
		const gargantuan = makeToken(1, 0, grid, 4, 4);
		expect(spacesBetween(medium, gargantuan)).toBe(1);
		expect(spacesBetween(gargantuan, medium)).toBe(1);
		expect(spacesBetween(medium, makeToken(2, 0, grid, 2, 2))).toBe(2);
	});

	it('measures a token as if it stood at the override position', () => {
		const grid = makeGrid();
		const a = makeToken(0, 0, grid);
		const b = makeToken(5, 0, grid);
		expect(spacesBetween(a, b, { a: { x: 4 * GRID_SIZE, y: 0 } })).toBe(1);
		expect(spacesBetween(a, b)).toBe(5);
	});

	it('uses the edge to edge gap on a gridless scene', () => {
		const grid = makeGrid('equidistant', true);
		expect(spacesBetween(makeToken(0, 0, grid), makeToken(0.5, 0, grid))).toBe(0);
		expect(spacesBetween(makeToken(0, 0, grid), makeToken(1, 0, grid))).toBe(1);
		expect(spacesBetween(makeToken(0, 0, grid), makeToken(1.5, 0, grid))).toBe(1);
		expect(spacesBetween(makeToken(0, 0, grid), makeToken(3.2, 0, grid))).toBe(3);
	});

	it('is infinite without a scene grid', () => {
		const a = { ...makeToken(0, 0, makeGrid()), parent: null };
		const b = { ...makeToken(1, 0, makeGrid()), parent: null };
		expect(spacesBetween(a, b)).toBe(Number.POSITIVE_INFINITY);
	});
});
