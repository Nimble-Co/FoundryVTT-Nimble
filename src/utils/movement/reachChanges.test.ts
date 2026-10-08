import { describe, expect, it } from 'vitest';
import type { MovementRecord } from '#types/movement.js';
import { reachChanges } from './reachChanges.js';

const GRID = 100;

const grid = {
	isGridless: false,
	size: GRID,
	distance: 1,
	measurePath([from, to]: { i: number; j: number }[]) {
		const spaces = Math.max(Math.abs(from.i - to.i), Math.abs(from.j - to.j));
		return { spaces, distance: spaces };
	},
};

const gridless = { ...grid, isGridless: true };

function makeDoc(gx: number, gy: number, scene = grid) {
	const doc = {
		x: gx * GRID,
		y: gy * GRID,
		width: 1,
		height: 1,
		parent: { grid: scene },
		getOccupiedGridSpaceOffsets(data?: { x?: number; y?: number }) {
			return [
				{ i: Math.floor((data?.y ?? doc.y) / GRID), j: Math.floor((data?.x ?? doc.x) / GRID) },
			];
		},
	};
	return doc as unknown as TokenDocument;
}

function makeRecord(
	path: [number, number][],
	{ scene = grid, kind = 'regular' } = {},
): MovementRecord {
	const positions = path.map(([gx, gy]) => ({ x: gx * GRID, y: gy * GRID }));
	return {
		token: makeDoc(path[0][0], path[0][1], scene),
		kind,
		path: positions,
		origin: positions[0],
		stop: positions.at(-1) ?? positions[0],
	} as unknown as MovementRecord;
}

describe('reachChanges', () => {
	const observer = makeDoc(3, 0);

	it('detects entering reach', () => {
		const change = reachChanges(
			makeRecord([
				[0, 0],
				[1, 0],
				[2, 0],
			]),
			observer,
		);
		expect(change).toMatchObject({
			entered: true,
			left: false,
			insideAtOrigin: false,
			insideAtStop: true,
		});
	});

	it('detects leaving reach', () => {
		const change = reachChanges(
			makeRecord([
				[2, 0],
				[1, 0],
				[0, 0],
			]),
			observer,
		);
		expect(change).toMatchObject({
			entered: false,
			left: true,
			insideAtOrigin: true,
			insideAtStop: false,
		});
	});

	it('detects a pass through reach that ends outside', () => {
		const change = reachChanges(
			makeRecord([
				[0, 0],
				[1, 0],
				[2, 0],
				[4, 1],
				[6, 0],
			]),
			observer,
		);
		expect(change.entered).toBe(true);
		expect(change.left).toBe(true);
		expect(change.insideAtStop).toBe(false);
	});

	it('honours a larger reach', () => {
		const change = reachChanges(
			makeRecord([
				[0, 0],
				[1, 0],
			]),
			observer,
			2,
		);
		expect(change.entered).toBe(true);
	});

	it('flags a step that overlapped the observer', () => {
		const change = reachChanges(
			makeRecord([
				[2, 0],
				[3, 0],
				[4, 0],
			]),
			observer,
		);
		expect(change.passedThrough).toBe(true);
	});

	it('sees a straight gridless drag pass through reach', () => {
		const change = reachChanges(
			makeRecord(
				[
					[0, 0],
					[6, 0],
				],
				{ scene: gridless },
			),
			makeDoc(3, 0, gridless),
		);
		expect(change).toEqual({
			entered: true,
			left: true,
			insideAtOrigin: false,
			insideAtStop: false,
			passedThrough: true,
		});
	});

	it('sees a gridless drag that stops inside reach', () => {
		const change = reachChanges(
			makeRecord(
				[
					[0, 0],
					[2, 0],
				],
				{ scene: gridless },
			),
			makeDoc(3, 0, gridless),
		);
		expect(change).toMatchObject({ entered: true, left: false, passedThrough: false });
	});

	it('does not fill in the gap of a gridless teleport', () => {
		const change = reachChanges(
			makeRecord(
				[
					[0, 0],
					[6, 0],
				],
				{ scene: gridless, kind: 'teleport' },
			),
			makeDoc(3, 0, gridless),
		);
		expect(change).toMatchObject({ entered: false, left: false, passedThrough: false });
	});
});
