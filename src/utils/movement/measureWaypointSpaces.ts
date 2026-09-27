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
 * number, and the legs up to any waypoint sum to the rounded distance to it.
 */
export function measureWaypointSpaces(
	token: MeasuringToken,
	waypoints: readonly object[],
): number[] {
	if (waypoints.length < 2) return [];
	const gridDistance = token.parent?.grid?.distance;
	if (!gridDistance) return waypoints.slice(1).map(() => 0);
	const { segments } = token.measureMovementPath([...waypoints]);

	const result: number[] = [];
	let travelled = 0;
	let counted = 0;
	for (let index = 0; index < waypoints.length - 1; index++) {
		travelled += segments[index]?.distance ?? 0;
		const total = Math.round(travelled / gridDistance);
		result.push(total - counted);
		counted = total;
	}
	return result;
}
