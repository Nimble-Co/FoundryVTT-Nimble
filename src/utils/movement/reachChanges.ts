import type {
	MeasurableTokenDocument,
	MovementRecord,
	ReachChange,
	TokenPosition,
} from '#types/movement.js';
import { spacesBetween } from './spacesBetween.js';

/**
 * Adds points along each segment, no further apart than `step`, so a gridless
 * path is tested between its waypoints as well.
 */
function samplePath(path: readonly TokenPosition[], step: number): TokenPosition[] {
	const samples = path.slice(0, 1);
	for (let index = 1; index < path.length; index++) {
		const from = path[index - 1];
		const to = path[index];
		const count = Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / step);
		for (let sample = 1; sample < count; sample++) {
			const fraction = sample / count;
			samples.push({
				...to,
				x: from.x + (to.x - from.x) * fraction,
				y: from.y + (to.y - from.y) * fraction,
			});
		}
		samples.push(to);
	}
	return samples;
}

/** How a finished Movement changed the mover's position relative to an observer's Reach. */
export function reachChanges(
	record: MovementRecord,
	observer: TokenDocument,
	reach = 1,
): ReachChange {
	const mover = record.token as unknown as MeasurableTokenDocument;
	const watcher = observer as unknown as MeasurableTokenDocument;
	const grid = mover.parent?.grid;
	// Core adds no steps between gridless waypoints, and a teleport crosses no space between.
	const path =
		grid?.isGridless && record.kind !== 'teleport'
			? samplePath(record.path, grid.size / 2)
			: record.path;
	const distances = path.map((position) => spacesBetween(mover, watcher, { a: position }));

	let entered = false;
	let left = false;
	let passedThrough = false;
	let wasInside = distances[0] <= reach;
	distances.forEach((distance, index) => {
		const inside = distance <= reach;
		if (inside && !wasInside) entered = true;
		if (!inside && wasInside) left = true;
		if (distance === 0 && index > 0 && index < distances.length - 1) passedThrough = true;
		wasInside = inside;
	});

	return {
		entered,
		left,
		insideAtOrigin: distances[0] <= reach,
		insideAtStop: (distances.at(-1) ?? Number.POSITIVE_INFINITY) <= reach,
		passedThrough,
	};
}
