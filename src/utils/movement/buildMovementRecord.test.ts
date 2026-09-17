import { describe, expect, it } from 'vitest';
import { buildMovementRecord } from './buildMovementRecord.js';
import { FORCED_MOVEMENT_ACTION } from './movementActions.js';

const GRID = 100;
const user = { id: 'u1' } as unknown as User;

type Waypoint = { x: number; y: number; action: string; movementId?: string | null };

function waypoint(gx: number, gy: number, movementId: string | null, action = 'walk'): Waypoint {
	return { x: gx * GRID, y: gy * GRID, action, movementId };
}

function makeToken(history: readonly Waypoint[] = []) {
	return {
		id: 't1',
		actor: null,
		movementHistory: history,
		parent: { id: 's1', grid: { isGridless: false, distance: 1 } },
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

function combatHolding(tokenId: string, sceneId: string, started = true) {
	return { started, combatants: [{ tokenId, sceneId }] };
}

function makeMovement(overrides: Partial<Parameters<typeof buildMovementRecord>[1]> = {}) {
	return {
		id: 'm1',
		chain: [],
		state: 'completed',
		constrained: false,
		origin: { x: 0, y: 0 },
		passed: { waypoints: [waypoint(3, 0, 'm1')] },
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
			makeToken([...earlier, ...movement.passed.waypoints]),
			movement,
			null,
			[combatHolding('t1', 's1')],
		);
		expect(record?.spaces).toBe(2);
		expect(record?.spacesThisTurn).toBe(6);
		expect(record?.path).toEqual([
			{ x: 0, y: 400 },
			{ x: 200, y: 400 },
		]);
	});

	it('counts this turn in a started combat the client is not viewing', () => {
		const movement = makeMovement();
		const token = makeToken([waypoint(0, 0, 'm1'), ...movement.passed.waypoints]);
		const combats = [combatHolding('other', 's1'), combatHolding('t1', 's1')];
		expect(buildMovementRecord(token, movement, null, combats)?.spacesThisTurn).toBe(3);
	});

	it('has no count this turn when the combat holding the token has not started', () => {
		const movement = makeMovement();
		const token = makeToken(movement.passed.waypoints);
		const combats = [combatHolding('t1', 's1', false), combatHolding('t1', 'other-scene')];
		expect(buildMovementRecord(token, movement, null, combats)?.spacesThisTurn).toBeNull();
	});

	it('keys a chained path on its first movement id', () => {
		const movement = makeMovement({
			id: 'm2',
			chain: ['m1'],
			passed: { waypoints: [waypoint(4, 0, 'm2')] },
			history: {
				recorded: { waypoints: [] },
				unrecorded: { waypoints: [waypoint(2, 0, 'm1')] },
			},
		});
		const record = buildMovementRecord(makeToken(), movement);
		expect(record?.movementId).toBe('m1');
		expect(record?.spaces).toBe(4);
	});

	it('reads the kind from the last waypoint', () => {
		const movement = makeMovement({
			passed: { waypoints: [waypoint(1, 0, 'm1', FORCED_MOVEMENT_ACTION)] },
		});
		expect(buildMovementRecord(makeToken(), movement)?.kind).toBe('forced');
	});

	it('flags a path the mover stopped', () => {
		expect(buildMovementRecord(makeToken(), makeMovement({ state: 'stopped' }))?.stopped).toBe(
			true,
		);
	});

	it('flags a path a wall or terrain constrained', () => {
		expect(buildMovementRecord(makeToken(), makeMovement({ constrained: true }))?.stopped).toBe(
			true,
		);
	});

	it('returns null when nothing was passed', () => {
		expect(
			buildMovementRecord(makeToken(), makeMovement({ passed: { waypoints: [] } })),
		).toBeNull();
	});
});
