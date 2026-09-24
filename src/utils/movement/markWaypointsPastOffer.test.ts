import { describe, expect, it } from 'vitest';
import { markWaypointsPastOffer, type OfferRulerWaypoint } from './markWaypointsPastOffer.js';
import { FORCED_MOVEMENT_ACTION, FREE_MOVEMENT_ACTION } from './movementActions.js';

const push = { kind: 'forced' as const, spaces: 2, ignoreDifficultTerrain: true };
const freeMove = { kind: 'free' as const, spaces: 2, ignoreDifficultTerrain: false };

function waypoint(
	stage: string,
	distance: number,
	action = FORCED_MOVEMENT_ACTION,
	cost = distance,
): OfferRulerWaypoint {
	return { stage, action, unreachable: false, measurement: { distance, cost } };
}

const unreachable = (path: OfferRulerWaypoint[]) => path.map((w) => w.unreachable);

describe('markWaypointsPastOffer', () => {
	it('marks the waypoints past the offered distance and leaves the rest', () => {
		const path = [0, 5, 10, 15, 20].map((d, i) => waypoint('planned', d, i ? undefined : 'walk'));
		markWaypointsPastOffer(path, push, 5);
		expect(unreachable(path)).toEqual([false, false, false, true, true]);
	});

	it('counts from the start of the drag, not from the history before it', () => {
		const path = [
			waypoint('passed', 0, 'walk'),
			waypoint('passed', 15, 'walk'),
			waypoint('planned', 15, 'walk'),
			waypoint('planned', 25),
			waypoint('planned', 30),
		];
		markWaypointsPastOffer(path, push, 5);
		expect(unreachable(path)).toEqual([false, false, false, false, true]);
	});

	it('measures a Free Move that honours difficult terrain by cost', () => {
		const path = [
			waypoint('planned', 0, 'walk'),
			waypoint('planned', 5, FREE_MOVEMENT_ACTION, 10),
			waypoint('planned', 10, FREE_MOVEMENT_ACTION, 15),
		];
		markWaypointsPastOffer(path, freeMove, 5);
		expect(unreachable(path)).toEqual([false, false, true]);
	});

	it('measures an offer that ignores difficult terrain by distance', () => {
		const path = [waypoint('planned', 0, 'walk'), waypoint('planned', 10, undefined, 20)];
		markWaypointsPastOffer(path, push, 5);
		expect(unreachable(path)).toEqual([false, false]);
	});

	it('leaves a drag the user moved under another action alone', () => {
		const path = [0, 5, 10, 15].map((d) => waypoint('planned', d, 'walk'));
		markWaypointsPastOffer(path, push, 5);
		expect(unreachable(path)).toEqual([false, false, false, false]);
	});

	it('does nothing to a path with no planned part', () => {
		const path = [waypoint('passed', 0), waypoint('passed', 50)];
		markWaypointsPastOffer(path, push, 5);
		expect(unreachable(path)).toEqual([false, false]);
	});
});
