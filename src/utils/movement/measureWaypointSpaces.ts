interface MeasuringToken {
	parent?: { grid?: { isGridless?: boolean; distance: number } } | null;
	measureMovementPath(waypoints: object[]): { segments: { distance: number; spaces: number }[] };
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
 * waypoint. On a gridless scene the distance in scene units is divided by the
 * grid distance and rounded to whole spaces.
 */
export function measureWaypointSpaces(
	token: MeasuringToken,
	waypoints: readonly SizedWaypoint[],
): number[] {
	if (waypoints.length < 2) return [];
	const grid = token.parent?.grid;
	const { segments } = token.measureMovementPath([...waypoints]);
	const toSpaces = (segment: { distance: number; spaces: number }): number =>
		grid?.isGridless ? Math.round(segment.distance / (grid.distance || 1)) : segment.spaces;

	const result: number[] = [];
	let cursor = 0;
	const previous = { ...waypoints[0] };
	for (let index = 1; index < waypoints.length; index++) {
		const current = waypoints[index];
		const resized = SIZE_KEYS.some(
			(key) => current[key] !== undefined && current[key] !== previous[key],
		);
		if (resized) cursor += 1;
		const segment = segments[cursor];
		result.push(segment ? toSpaces(segment) : 0);
		cursor += 1;
		for (const key of SIZE_KEYS) if (current[key] !== undefined) previous[key] = current[key];
	}
	return result;
}
