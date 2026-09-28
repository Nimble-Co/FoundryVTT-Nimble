import { describe, expect, it } from 'vitest';
import { measureWaypointSpaces } from './measureWaypointSpaces.js';

type Segment = { distance: number; spaces: number };

function makeToken(segments: Segment[], grid = { isGridless: false, distance: 5 }) {
	return {
		parent: { grid },
		measureMovementPath: () => ({ segments }),
	};
}

type Diagonals =
	| 'equidistant'
	| 'exact'
	| 'approximate'
	| 'rectilinear'
	| 'alternating1'
	| 'alternating2'
	| 'illegal';

type GridPoint = { x: number; y: number };

/** Mirrors core's square grid measurePath for 2D moves between grid spaces. */
function makeSquareToken(diagonals: Diagonals, gridDistance = 5) {
	return {
		parent: { grid: { isGridless: false, distance: gridDistance } },
		measureMovementPath(waypoints: GridPoint[]) {
			let diagonalsSoFar = diagonals === 'alternating2' ? 1.5 : 0;
			const segments: Segment[] = [];
			for (let index = 1; index < waypoints.length; index++) {
				const dx = Math.abs(waypoints[index].x - waypoints[index - 1].x);
				const dy = Math.abs(waypoints[index].y - waypoints[index - 1].y);
				const [long, short] = dx < dy ? [dy, dx] : [dx, dy];
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
						const before = diagonalsSoFar;
						diagonalsSoFar += short;
						cost = long + Math.floor(diagonalsSoFar / 2) - Math.floor(before / 2);
					}
				}
				segments.push({ spaces, distance: cost * gridDistance });
			}
			return { segments };
		},
	};
}

const diagonalSteps = (count: number): GridPoint[] =>
	Array.from({ length: count + 1 }, (_, index) => ({ x: index, y: index }));

describe('measureWaypointSpaces', () => {
	const withDistances = (distances: number[]) =>
		makeToken(distances.map((distance) => ({ distance, spaces: 0 })));
	const walkTeleportWalk = [
		{ action: 'walk' },
		{ action: 'walk' },
		{ action: 'displace' },
		{ action: 'walk' },
	];

	it('rounds a measured teleport apart, so it never adds a space to the moves around it', () => {
		// 2.5 + 2.5 feet walked on 5 foot spaces is 1 space, whatever the teleport between covers.
		const legs = measureWaypointSpaces(withDistances([2.5, 2.5, 2.5]), walkTeleportWalk);
		expect(legs[0] + legs[2]).toBe(1);
	});

	it('rounds a measured teleport apart, so it never takes a space from the moves around it', () => {
		// 2.4 + 2.4 feet walked is 0.96 spaces, which rounds to 1.
		const legs = measureWaypointSpaces(withDistances([2.4, 0.2, 2.4]), walkTeleportWalk);
		expect(legs[0] + legs[2]).toBe(1);
	});

	it('returns nothing for fewer than two waypoints', () => {
		expect(measureWaypointSpaces(makeToken([]), [{ x: 0 }])).toEqual([]);
	});

	it('maps one segment to each waypoint after the first', () => {
		const token = makeToken([
			{ distance: 5, spaces: 1 },
			{ distance: 15, spaces: 3 },
		]);
		expect(measureWaypointSpaces(token, [{ width: 1 }, { width: 1 }, { width: 1 }])).toEqual([
			1, 3,
		]);
	});

	it('reads one segment per waypoint across a size change, as core returns', () => {
		const token = makeToken([
			{ distance: 5, spaces: 1 },
			{ distance: 10, spaces: 2 },
			{ distance: 15, spaces: 3 },
		]);
		expect(
			measureWaypointSpaces(token, [
				{ width: 1, height: 1 },
				{ width: 1, height: 1 },
				{ width: 2, height: 2 },
				{ width: 2, height: 2 },
			]),
		).toEqual([1, 2, 3]);
	});

	it('converts gridless distance to whole spaces', () => {
		const token = makeToken([{ distance: 12, spaces: 0 }], { isGridless: true, distance: 5 });
		expect(measureWaypointSpaces(token, [{}, {}])).toEqual([2]);
	});

	it.each([
		['equidistant', [1, 1, 1, 1]],
		['illegal', [2, 2, 2, 2]],
		['alternating1', [1, 2, 1, 2]],
		['alternating2', [2, 1, 2, 1]],
		['rectilinear', [2, 2, 2, 2]],
	] as const)('counts diagonal steps by the %s rule', (diagonals, legs) => {
		expect(measureWaypointSpaces(makeSquareToken(diagonals), diagonalSteps(4))).toEqual(legs);
	});

	it('counts four diagonals in one leg as 6 under alternating 1', () => {
		const token = makeSquareToken('alternating1');
		expect(measureWaypointSpaces(token, [diagonalSteps(4)[0], diagonalSteps(4)[4]])).toEqual([6]);
	});

	it('rounds the running distance so the legs sum to the rounded total', () => {
		expect(measureWaypointSpaces(makeSquareToken('exact'), diagonalSteps(2))).toEqual([1, 2]);
		expect(measureWaypointSpaces(makeSquareToken('approximate'), diagonalSteps(1))).toEqual([2]);
	});

	it('rounds gridless legs on the running total, not one by one', () => {
		const gridless = { isGridless: true, distance: 5 };
		const nearlyWhole = makeToken(
			[
				{ distance: 7, spaces: 0 },
				{ distance: 7, spaces: 0 },
				{ distance: 7, spaces: 0 },
			],
			gridless,
		);
		expect(measureWaypointSpaces(nearlyWhole, [{}, {}, {}, {}])).toEqual([1, 2, 1]);
		const halves = makeToken(
			[
				{ distance: 7.5, spaces: 0 },
				{ distance: 7.5, spaces: 0 },
			],
			gridless,
		);
		expect(measureWaypointSpaces(halves, [{}, {}, {}])).toEqual([2, 1]);
	});

	it('counts nothing without a grid distance', () => {
		const token = makeToken([{ distance: 5, spaces: 1 }], { isGridless: false, distance: 0 });
		expect(measureWaypointSpaces(token, [{}, {}])).toEqual([0]);
	});
});
