import type { MoveBandWaypoint } from '#types/movement.js';
import { getMovementKind } from './movementKind.js';

const EPSILON = 1e-6;

interface MoveBandOptions {
	gridDistance: number;
	/** The creature's Speed, in spaces, for a movement action. */
	speedFor(action: string): number;
}

/**
 * Marks each planned waypoint of a drag that uses the creature's own movement
 * with the Move it falls in: the first Speed spaces are Move 1, the next Speed
 * spaces Move 2, and so on. The count goes on from the creature's own movement
 * earlier in the history, and it runs on cost, so difficult terrain counts
 * double. A Free Move, Forced Movement and a Teleport never count. Only the
 * part of the drag under a movement action the creature has no Speed for is
 * drawn as out of reach, and it adds nothing to the count; the drag itself
 * never changes.
 */
export function markMoveBands(
	path: MoveBandWaypoint[],
	{ gridDistance, speedFor }: MoveBandOptions,
): void {
	let moves = 0;
	for (let index = 1; index < path.length; index++) {
		const waypoint = path[index];
		if (getMovementKind(waypoint.action) !== 'regular') continue;
		const speed = Math.max(speedFor(waypoint.action), 0);
		const cost = waypoint.measurement.cost - path[index - 1].measurement.cost;
		const noSpeed = cost > 0 && speed === 0;
		if (cost > 0 && !noSpeed) moves += cost / (speed * gridDistance);
		if (waypoint.stage !== 'planned') continue;

		if (noSpeed) {
			waypoint.unreachable = true;
			continue;
		}
		waypoint.moveBand = Math.max(1, Math.ceil(moves - EPSILON));
	}
}
