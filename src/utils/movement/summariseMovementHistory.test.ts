import { afterEach, describe, expect, it } from 'vitest';
import { FORCED_MOVEMENT_ACTION, FREE_MOVEMENT_ACTION } from './movementActions.js';
import { summariseMovementHistory } from './summariseMovementHistory.js';

type Waypoint = { x: number; y: number; action: string };
type TokenConfig = { movement?: { actions?: Record<string, { teleport?: boolean }> } };

const originalToken = (CONFIG as unknown as { Token?: TokenConfig }).Token;

/** A square-grid token whose measurement counts Chebyshev steps between waypoints. */
function makeToken(gridless = false, gridDistance = 1) {
	return {
		parent: { grid: { isGridless: gridless, distance: gridDistance } },
		measureMovementPath(waypoints: Waypoint[]) {
			const segments: { spaces: number; distance: number }[] = [];
			for (let i = 1; i < waypoints.length; i++) {
				const dx = Math.abs(waypoints[i].x - waypoints[i - 1].x);
				const dy = Math.abs(waypoints[i].y - waypoints[i - 1].y);
				segments.push({
					spaces: gridless ? 0 : Math.max(dx, dy),
					distance: Math.hypot(dx, dy) * gridDistance,
				});
			}
			return { segments };
		},
	};
}

describe('summariseMovementHistory', () => {
	afterEach(() => {
		(CONFIG as unknown as { Token?: TokenConfig }).Token = originalToken;
	});

	it('returns zeros for an empty or single-waypoint history', () => {
		const token = makeToken();
		expect(summariseMovementHistory(token, []).counted).toBe(0);
		expect(summariseMovementHistory(token, [{ x: 0, y: 0, action: 'walk' }]).counted).toBe(0);
	});

	it('attributes each segment to the action of the waypoint it arrives at', () => {
		const token = makeToken();
		const history: Waypoint[] = [
			{ x: 0, y: 0, action: 'walk' },
			{ x: 2, y: 0, action: 'walk' },
			{ x: 2, y: 3, action: FREE_MOVEMENT_ACTION },
			{ x: 3, y: 3, action: FORCED_MOVEMENT_ACTION },
		];
		expect(summariseMovementHistory(token, history)).toEqual({
			regular: 2,
			free: 3,
			forced: 1,
			teleport: 0,
			counted: 6,
		});
	});

	it('never counts a teleport, even when it was measured', () => {
		(CONFIG as unknown as { Token: TokenConfig }).Token = {
			movement: { actions: { blink: { teleport: true } } },
		};
		const token = makeToken();
		const history: Waypoint[] = [
			{ x: 0, y: 0, action: 'walk' },
			{ x: 1, y: 0, action: 'walk' },
			{ x: 6, y: 0, action: 'blink' },
		];
		const summary = summariseMovementHistory(token, history);
		expect(summary.teleport).toBe(5);
		expect(summary.counted).toBe(1);
	});

	it('derives spaces from distance on a gridless scene', () => {
		const token = makeToken(true, 5);
		const history: Waypoint[] = [
			{ x: 0, y: 0, action: 'walk' },
			{ x: 3, y: 4, action: 'walk' },
		];
		expect(summariseMovementHistory(token, history).regular).toBe(5);
	});
});
