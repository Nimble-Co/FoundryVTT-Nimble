import type { MeasurableTokenDocument, MovementRecord, ReachChange } from '#types/movement.js';
import { spacesBetween } from './spacesBetween.js';

/** How a finished Movement changed the mover's position relative to an observer's Reach. */
export function reachChanges(
	record: MovementRecord,
	observer: TokenDocument,
	reach = 1,
): ReachChange {
	const mover = record.token as unknown as MeasurableTokenDocument;
	const watcher = observer as unknown as MeasurableTokenDocument;
	const distances = record.path.map((position) => spacesBetween(mover, watcher, { a: position }));

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
