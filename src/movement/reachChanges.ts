import type { MovementRecord } from './movementRecord.js';
import { type MeasurableTokenDocument, spacesBetween } from './spacesBetween.js';

export interface ReachChange {
	/** The mover was outside the observer's Reach at some step and inside at a later one. */
	entered: boolean;
	/** The mover was inside the observer's Reach at some step and outside at a later one. */
	left: boolean;
	insideAtOrigin: boolean;
	insideAtStop: boolean;
	/** A step of the path overlapped the observer's footprint. */
	passedThrough: boolean;
}

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
