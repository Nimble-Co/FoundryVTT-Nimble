import type { MovementKind } from '#types/movement.js';
import { measureWaypointSpaces } from './measureWaypointSpaces.js';
import { getMovementKind } from './movementKind.js';

export interface MovementHistorySummary {
	regular: number;
	free: number;
	forced: number;
	teleport: number;
	/** Spaces that count as Movement: regular, free and forced. */
	counted: number;
}

interface MeasurableToken {
	parent?: { grid?: { distance: number } } | null;
	measureMovementPath(waypoints: object[]): { segments: { distance: number }[] };
}

/**
 * Sums the spaces of a movement history by Movement kind. The history is
 * measured once as a whole so alternating diagonal rules stay consistent, and
 * each leg is attributed to the action of the waypoint it arrives at. Legs are
 * rounded on the running distance, not one by one, so the summary adds up to
 * the whole history's distance rounded to the nearest space.
 */
export function summariseMovementHistory(
	token: MeasurableToken,
	waypoints: readonly ({ action: string } & Record<string, unknown>)[],
): MovementHistorySummary {
	const summary: MovementHistorySummary = {
		regular: 0,
		free: 0,
		forced: 0,
		teleport: 0,
		counted: 0,
	};
	if (waypoints.length < 2) return summary;

	measureWaypointSpaces(token, waypoints).forEach((spaces, index) => {
		const kind: MovementKind = getMovementKind(waypoints[index + 1].action);
		summary[kind] += spaces;
	});

	summary.counted = summary.regular + summary.free + summary.forced;
	return summary;
}
