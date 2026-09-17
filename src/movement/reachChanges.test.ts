import { describe, expect, it } from 'vitest';
import type { MovementRecord } from './movementRecord.js';
import { reachChanges } from './reachChanges.js';

const GRID = 100;

const grid = {
	isGridless: false,
	size: GRID,
	measurePath([from, to]: { i: number; j: number }[]) {
		return { spaces: Math.max(Math.abs(from.i - to.i), Math.abs(from.j - to.j)) };
	},
};

function makeDoc(gx: number, gy: number) {
	const doc = {
		x: gx * GRID,
		y: gy * GRID,
		width: 1,
		height: 1,
		parent: { grid },
		getOccupiedGridSpaceOffsets(data?: { x?: number; y?: number }) {
			return [
				{ i: Math.floor((data?.y ?? doc.y) / GRID), j: Math.floor((data?.x ?? doc.x) / GRID) },
			];
		},
	};
	return doc as unknown as TokenDocument;
}

function makeRecord(path: [number, number][]): MovementRecord {
	const positions = path.map(([gx, gy]) => ({ x: gx * GRID, y: gy * GRID }));
	return {
		token: makeDoc(path[0][0], path[0][1]),
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
});
