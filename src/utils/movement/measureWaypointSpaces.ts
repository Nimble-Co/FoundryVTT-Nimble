import { getMovementKind } from './movementKind.js';

interface MeasuringToken {
	parent?: { grid?: { distance: number } } | null;
	measureMovementPath(waypoints: object[]): { segments: { distance: number }[] };
}

/**
 * Spaces travelled to reach each waypoint after the first, measured over the
 * whole path in one call so alternating diagonal rules stay consistent. Core
 * drops the resize segments it adds for size changes, so there is one segment
 * for each waypoint after the first. Spaces are the distance in scene units
 * over the grid distance, so every diagonal rule and gridless scenes are
 * honoured. Rounding is cumulative, never per segment: each leg is a whole
 * number, and the moving legs up to any waypoint sum to the rounded distance
 * moved to it. Teleport legs keep a running total of their own, so a measured
 * teleport never moves where the spaces of the other legs fall.
 */
export function measureWaypointSpaces(
	token: MeasuringToken,
	waypoints: readonly object[],
): number[] {
	if (waypoints.length < 2) return [];
	const gridDistance = token.parent?.grid?.distance;
	if (!gridDistance) return waypoints.slice(1).map(() => 0);
	const { segments } = token.measureMovementPath([...waypoints]);

	const travelled = { moved: 0, teleported: 0 };
	const counted = { moved: 0, teleported: 0 };
	const result: number[] = [];
	for (let index = 0; index < waypoints.length - 1; index++) {
		const action = (waypoints[index + 1] as { action?: string }).action ?? '';
		const kind = getMovementKind(action) === 'teleport' ? 'teleported' : 'moved';
		travelled[kind] += segments[index]?.distance ?? 0;
		const spaces = Math.round(travelled[kind] / gridDistance);
		result.push(spaces - counted[kind]);
		counted[kind] = spaces;
	}
	return result;
}
