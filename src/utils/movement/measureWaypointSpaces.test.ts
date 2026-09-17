import { describe, expect, it } from 'vitest';
import { measureWaypointSpaces } from './measureWaypointSpaces.js';

type Segment = { distance: number; spaces: number };

function makeToken(segments: Segment[], grid = { isGridless: false, distance: 5 }) {
	return {
		parent: { grid },
		measureMovementPath: () => ({ segments }),
	};
}

describe('measureWaypointSpaces', () => {
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

	it('skips the unmeasured resize segment core inserts before a size change', () => {
		const token = makeToken([
			{ distance: 5, spaces: 1 },
			{ distance: 0, spaces: 0 },
			{ distance: 10, spaces: 2 },
		]);
		expect(
			measureWaypointSpaces(token, [
				{ width: 1, height: 1 },
				{ width: 1, height: 1 },
				{ width: 2, height: 2 },
			]),
		).toEqual([1, 2]);
	});

	it('treats a missing size field as unchanged', () => {
		const token = makeToken([{ distance: 5, spaces: 1 }]);
		expect(measureWaypointSpaces(token, [{ width: 2, height: 2 }, {}])).toEqual([1]);
	});

	it('converts gridless distance to whole spaces', () => {
		const token = makeToken([{ distance: 12, spaces: 0 }], { isGridless: true, distance: 5 });
		expect(measureWaypointSpaces(token, [{}, {}])).toEqual([2]);
	});
});
