import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MoveBandWaypoint } from '#types/movement.js';
import { markMoveBands } from './markMoveBands.js';
import { FORCED_MOVEMENT_ACTION, FREE_MOVEMENT_ACTION } from './movementActions.js';

const GRID_DISTANCE = 5;
const speeds: Record<string, number> = { walk: 6, fly: 8 };
const options = {
	gridDistance: GRID_DISTANCE,
	speedFor: (action: string) => speeds[action] ?? speeds.walk,
};

/** A path through the given legs, each `[stage, action, spaces, costMultiplier]`. */
function pathOf(...legs: [string, string, number, number?][]): MoveBandWaypoint[] {
	let cost = 0;
	const path: MoveBandWaypoint[] = [
		{ stage: legs[0][0], action: 'walk', unreachable: false, measurement: { cost: 0 } },
	];
	for (const [stage, action, spaces, multiplier = 1] of legs) {
		cost += spaces * GRID_DISTANCE * multiplier;
		path.push({ stage, action, unreachable: false, measurement: { cost } });
	}
	return path;
}

const bands = (path: MoveBandWaypoint[]) =>
	path.slice(1).map((waypoint) => waypoint.moveBand ?? null);
const unreachable = (path: MoveBandWaypoint[]) =>
	path.slice(1).map((waypoint) => waypoint.unreachable);

describe('markMoveBands', () => {
	beforeEach(() => {
		vi.stubGlobal('CONFIG', {
			...CONFIG,
			Token: { movement: { actions: { blink: { teleport: true } } } },
		});
		return () => vi.unstubAllGlobals();
	});

	it('puts the first Speed spaces in Move 1 and the next Speed spaces in Move 2', () => {
		const path = pathOf(['planned', 'walk', 4], ['planned', 'walk', 2], ['planned', 'walk', 1]);
		markMoveBands(path, options);
		expect(bands(path)).toEqual([1, 1, 2]);
	});

	it('goes on from the own movement earlier in the turn', () => {
		const path = pathOf(['passed', 'walk', 5], ['planned', 'walk', 1], ['planned', 'walk', 3]);
		markMoveBands(path, options);
		expect(bands(path)).toEqual([null, 1, 2]);
	});

	it('never counts a Free Move, Forced Movement or a Teleport', () => {
		const path = pathOf(
			['passed', FREE_MOVEMENT_ACTION, 4],
			['passed', FORCED_MOVEMENT_ACTION, 3],
			['passed', 'blink', 5],
			['planned', 'walk', 2],
		);
		markMoveBands(path, options);
		expect(bands(path)).toEqual([null, null, null, 1]);
	});

	it('counts difficult terrain double', () => {
		const path = pathOf(['planned', 'walk', 3, 2], ['planned', 'walk', 1]);
		markMoveBands(path, options);
		expect(bands(path)).toEqual([1, 2]);
	});

	it('goes on counting past the third Move and never draws it out of reach', () => {
		const path = pathOf(['planned', 'walk', 18], ['planned', 'walk', 1]);
		markMoveBands(path, options);
		expect(bands(path)).toEqual([3, 4]);
		expect(unreachable(path)).toEqual([false, false]);
	});

	it('measures each leg against the Speed of its own movement action', () => {
		const path = pathOf(['planned', 'walk', 3], ['planned', 'fly', 4], ['planned', 'fly', 1]);
		markMoveBands(path, options);
		expect(bands(path)).toEqual([1, 1, 2]);
	});

	it('draws any own movement of a creature with no Speed as out of reach', () => {
		const path = pathOf(['planned', 'walk', 1]);
		markMoveBands(path, { ...options, speedFor: () => 0 });
		expect(bands(path)).toEqual([null]);
		expect(unreachable(path)).toEqual([true]);
	});

	it('marks nothing on a path with no planned part', () => {
		const path = pathOf(['passed', 'walk', 4], ['passed', 'walk', 4]);
		markMoveBands(path, options);
		expect(bands(path)).toEqual([null, null]);
		expect(unreachable(path)).toEqual([false, false]);
	});
});
