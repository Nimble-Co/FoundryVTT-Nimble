interface MeasuringToken {
	parent?: { grid?: { distance: number } } | null;
	measureMovementPath(waypoints: object[]): { segments: { distance: number }[] };
}

type SizedWaypoint = Record<string, unknown> & {
	width?: number;
	height?: number;
	depth?: number;
	shape?: number;
};

const SIZE_KEYS = ['width', 'height', 'depth', 'shape'] as const;

/**
 * Spaces travelled to reach each waypoint after the first, measured over the
 * whole path in one call so alternating diagonal rules stay consistent. Core
 * inserts an unmeasured resize segment before any waypoint whose size differs
 * from the previous one; those are skipped so each result lines up with its
 * waypoint. Spaces are the distance in scene units over the grid distance, so
 * every diagonal rule is honoured. Rounding is cumulative: each leg is a whole
 * number, and the legs up to any waypoint sum to the rounded distance to it.
 */
export function measureWaypointSpaces(
	token: MeasuringToken,
	waypoints: readonly SizedWaypoint[],
): number[] {
	if (waypoints.length < 2) return [];
	const gridDistance = token.parent?.grid?.distance;
	if (!gridDistance) return waypoints.slice(1).map(() => 0);
	const { segments } = token.measureMovementPath([...waypoints]);

	const result: number[] = [];
	let cursor = 0;
	let travelled = 0;
	let counted = 0;
	const previous = { ...waypoints[0] };
	for (let index = 1; index < waypoints.length; index++) {
		const current = waypoints[index];
		const resized = SIZE_KEYS.some(
			(key) => current[key] !== undefined && current[key] !== previous[key],
		);
		if (resized) cursor += 1;
		travelled += segments[cursor]?.distance ?? 0;
		const total = Math.round(travelled / gridDistance);
		result.push(total - counted);
		counted = total;
		cursor += 1;
		for (const key of SIZE_KEYS) if (current[key] !== undefined) previous[key] = current[key];
	}
	return result;
}
