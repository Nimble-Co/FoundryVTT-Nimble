import { describe, expect, it } from 'vitest';
import { buildMovementRecord } from './buildMovementRecord.js';
import { FORCED_MOVEMENT_ACTION } from './movementActions.js';

const GRID = 100;
const user = { id: 'u1' } as unknown as User;

type Waypoint = { x: number; y: number; action: string; movementId?: string | null };

function waypoint(gx: number, gy: number, movementId: string | null, action = 'walk'): Waypoint {
	return { x: gx * GRID, y: gy * GRID, action, movementId };
}

function makeToken(history: Waypoint[] = [], started = false) {
	return {
		actor: null,
		movementHistory: history,
		combatant: started ? { parent: { started: true } } : null,
		parent: { grid: { isGridless: false, distance: 1 } },
		measureMovementPath(waypoints: { x: number; y: number }[]) {
			const segments: { distance: number; spaces: number }[] = [];
			for (let i = 1; i < waypoints.length; i++) {
				const dx = Math.abs(waypoints[i].x - waypoints[i - 1].x) / GRID;
				const dy = Math.abs(waypoints[i].y - waypoints[i - 1].y) / GRID;
				segments.push({ distance: Math.max(dx, dy), spaces: Math.max(dx, dy) });
			}
			return { segments };
		},
		getCompleteMovementPath(waypoints: { x: number; y: number }[]) {
			return waypoints.map(({ x, y }) => ({ x, y }));
		},
	};
}

function makeMovement(overrides: Partial<Parameters<typeof buildMovementRecord>[1]> = {}) {
	return {
		id: 'm1',
		chain: [],
		state: 'completed',
		constrained: false,
		origin: { x: 0, y: 0 },
		passed: { waypoints: [waypoint(0, 0, 'm1'), waypoint(3, 0, 'm1')] },
		history: { recorded: { waypoints: [] }, unrecorded: { waypoints: [] } },
		user,
		...overrides,
	};
}

describe('buildMovementRecord', () => {
	it('records a single leg from origin to stop', () => {
		const record = buildMovementRecord(makeToken(), makeMovement());
		expect(record).toMatchObject({
			movementId: 'm1',
			kind: 'regular',
			spaces: 3,
			spacesThisTurn: null,
			stopped: false,
			origin: { x: 0, y: 0 },
			stop: { x: 300, y: 0 },
		});
		expect(record?.path).toEqual([
			{ x: 0, y: 0 },
			{ x: 0, y: 0 },
			{ x: 300, y: 0 },
		]);
	});

	it('counts only this chain when earlier history exists', () => {
		const earlier = [waypoint(0, 0, 'm0'), waypoint(0, 4, 'm0')];
		const movement = makeMovement({
			origin: { x: 0, y: 400 },
			passed: { waypoints: [waypoint(2, 4, 'm1')] },
			history: { recorded: { waypoints: earlier }, unrecorded: { waypoints: [] } },
		});
		const record = buildMovementRecord(
			makeToken([...earlier, ...movement.passed.waypoints], true),
			movement,
		);
		expect(record?.spaces).toBe(2);
		expect(record?.spacesThisTurn).toBe(6);
		expect(record?.path).toEqual([
			{ x: 0, y: 400 },
			{ x: 200, y: 400 },
		]);
	});

	it('keys a chained path on its first movement id', () => {
		const movement = makeMovement({
			id: 'm2',
			chain: ['m1'],
			passed: { waypoints: [waypoint(4, 0, 'm2')] },
			history: {
				recorded: { waypoints: [] },
				unrecorded: { waypoints: [waypoint(0, 0, 'm1'), waypoint(2, 0, 'm1')] },
			},
		});
		const record = buildMovementRecord(makeToken(), movement);
		expect(record?.movementId).toBe('m1');
		expect(record?.spaces).toBe(4);
	});

	it('reads the kind from the last waypoint and flags a stopped path', () => {
		const movement = makeMovement({
			state: 'stopped',
			constrained: true,
			passed: { waypoints: [waypoint(0, 0, 'm1'), waypoint(1, 0, 'm1', FORCED_MOVEMENT_ACTION)] },
		});
		const record = buildMovementRecord(makeToken(), movement);
		expect(record?.kind).toBe('forced');
		expect(record?.stopped).toBe(true);
	});

	it('returns null when nothing was passed', () => {
		expect(
			buildMovementRecord(makeToken(), makeMovement({ passed: { waypoints: [] } })),
		).toBeNull();
	});
});
