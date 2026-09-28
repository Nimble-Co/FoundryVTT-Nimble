import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { systemHookName } from '#system';
import { AUTOMATION_SETTING_KEYS } from '../../settings/automationSettings.js';
import { NimbleTokenDocument } from './tokenDocument.js';

function tokenWithActorType(type: string | null | undefined): TokenDocument {
	return {
		actor: type ? ({ type } as Actor.Implementation) : undefined,
	} as TokenDocument;
}

describe('NimbleTokenDocument.getCombatantType', () => {
	it('returns npc for minion actors because combatant schema does not allow minion type', () => {
		expect(NimbleTokenDocument.getCombatantType(tokenWithActorType('minion'))).toBe('npc');
	});

	it('returns character for character actors', () => {
		expect(NimbleTokenDocument.getCombatantType(tokenWithActorType('character'))).toBe('character');
	});

	it('returns soloMonster for solo monster actors', () => {
		expect(NimbleTokenDocument.getCombatantType(tokenWithActorType('soloMonster'))).toBe(
			'soloMonster',
		);
	});

	it('returns npc by default', () => {
		expect(NimbleTokenDocument.getCombatantType(tokenWithActorType('npc'))).toBe('npc');
		expect(NimbleTokenDocument.getCombatantType(tokenWithActorType(undefined))).toBe('npc');
	});
});

describe('NimbleTokenDocument._shouldRecordMovementHistory', () => {
	type Globals = { game: { combats?: unknown; settings?: unknown } };
	const globals = globalThis as unknown as Globals;
	const base = Object.getPrototypeOf(NimbleTokenDocument.prototype) as {
		_shouldRecordMovementHistory?: () => boolean;
	};
	const original = { combats: globals.game.combats, settings: globals.game.settings };
	const coreRecords = vi.fn(() => false);

	function setMovementTracking(enabled: boolean) {
		globals.game.settings = {
			get: (_namespace: string, key: string) =>
				key === AUTOMATION_SETTING_KEYS.movementTracking ? enabled : undefined,
		};
	}

	function combatHolding(tokenId: string, sceneId: string, started = true) {
		return { started, combatants: [{ tokenId, sceneId }] };
	}

	function shouldRecord(): boolean {
		const token = new NimbleTokenDocument({
			id: 't1',
			parent: { id: 's1' },
		} as never) as unknown as {
			_shouldRecordMovementHistory(): boolean;
		};
		return token._shouldRecordMovementHistory();
	}

	beforeEach(() => {
		base._shouldRecordMovementHistory = coreRecords;
	});

	afterEach(() => {
		delete base._shouldRecordMovementHistory;
		globals.game.combats = original.combats;
		globals.game.settings = original.settings;
	});

	it('records in a started combat the client is not viewing', () => {
		setMovementTracking(true);
		globals.game.combats = [combatHolding('other', 's1'), combatHolding('t1', 's1')];
		expect(shouldRecord()).toBe(true);
		expect(coreRecords).not.toHaveBeenCalled();
	});

	it('does not record when no started combat holds the token on its scene', () => {
		setMovementTracking(true);
		globals.game.combats = [combatHolding('t1', 's1', false), combatHolding('t1', 's2')];
		expect(shouldRecord()).toBe(false);
	});

	it('leaves the decision to core while Movement Tracking is off', () => {
		setMovementTracking(false);
		globals.game.combats = [combatHolding('t1', 's1')];
		expect(shouldRecord()).toBe(false);
		expect(coreRecords).toHaveBeenCalledOnce();
	});
});

describe('NimbleTokenDocument movementFinished report', () => {
	const base = Object.getPrototypeOf(NimbleTokenDocument.prototype) as {
		_onUpdateMovement?: () => void;
		_onMovementStopped?: () => void;
	};
	const baseGame = game;
	const callAll = vi.fn();
	let tracking: boolean;

	type Waypoint = { x: number; y: number; action: string; movementId: string };
	type Movement = ReturnType<typeof movement>;
	type MovingToken = {
		_onUpdateMovement(movement: Movement, operation: object, user: object): void;
		_onMovementStopped(): void;
	};

	const waypoint = (x: number, movementId: string): Waypoint => ({
		x: x * 100,
		y: 0,
		action: 'walk',
		movementId,
	});

	function movement(id: string, state: string, chain: string[] = []) {
		return {
			id,
			chain,
			state,
			constrained: false,
			user: { id: 'u1' },
			passed: { waypoints: [waypoint(3, id)] },
			history: {
				recorded: { waypoints: [] },
				unrecorded: { waypoints: [waypoint(0, chain[0] ?? id)] },
			},
		};
	}

	/** A token whose current Movement is whatever the test last moved it to. */
	function tokenMoving(first: Movement) {
		let current = first;
		const token = new NimbleTokenDocument({
			id: 't1',
			actor: null,
			movementHistory: [],
			parent: { id: 's1', grid: { isGridless: false, distance: 1 } },
			measureMovementPath: (waypoints: Waypoint[]) => ({
				segments: waypoints.slice(1).map((to, index) => ({
					distance: Math.abs(to.x - waypoints[index].x) / 100,
				})),
			}),
			getCompleteMovementPath: (waypoints: Waypoint[]) => waypoints.map(({ x, y }) => ({ x, y })),
		} as never) as unknown as MovingToken;
		Object.defineProperty(token, 'movement', { get: () => current });
		return {
			token,
			moveTo(next: Movement) {
				current = next;
			},
		};
	}

	const reports = () =>
		callAll.mock.calls
			.filter(([hook]) => hook === systemHookName('movementFinished'))
			.map(([, record]) => record as { movementId: string; spaces: number; stopped: boolean });

	beforeEach(() => {
		tracking = true;
		callAll.mockClear();
		base._onUpdateMovement = () => {};
		base._onMovementStopped = () => {};
		vi.stubGlobal('Hooks', { ...(globalThis as { Hooks?: object }).Hooks, callAll });
		vi.stubGlobal('game', {
			...baseGame,
			combats: [],
			settings: {
				get: (_namespace: string, key: string) =>
					key === AUTOMATION_SETTING_KEYS.movementTracking ? tracking : undefined,
			},
		});
	});

	afterEach(() => {
		delete base._onUpdateMovement;
		delete base._onMovementStopped;
		vi.unstubAllGlobals();
	});

	it('reports a completed Movement once, however many callbacks follow', () => {
		const completed = movement('m1', 'completed');
		const { token } = tokenMoving(completed);
		token._onUpdateMovement(completed, {}, {});
		token._onUpdateMovement(completed, {}, {});
		token._onMovementStopped();
		expect(reports()).toEqual([expect.objectContaining({ movementId: 'm1', spaces: 3 })]);
	});

	it('reports a Movement that was stopped', () => {
		const { token } = tokenMoving(movement('m1', 'stopped'));
		token._onMovementStopped();
		expect(reports()).toEqual([expect.objectContaining({ movementId: 'm1', stopped: true })]);
	});

	it('says nothing while the Movement is planned, pending or paused', () => {
		for (const state of ['planned', 'pending', 'paused']) {
			const current = movement('m1', state);
			tokenMoving(current).token._onUpdateMovement(current, {}, {});
		}
		expect(reports()).toEqual([]);
	});

	it('reports a paused Movement once its continuation finishes, under the first id', () => {
		const paused = movement('m1', 'paused');
		const { token, moveTo } = tokenMoving(paused);
		token._onUpdateMovement(paused, {}, {});
		const continued = movement('m2', 'completed', ['m1']);
		moveTo(continued);
		token._onUpdateMovement(continued, {}, {});
		expect(reports()).toEqual([expect.objectContaining({ movementId: 'm1' })]);
	});

	it('ignores an update for a Movement the token has already moved on from', () => {
		const { token } = tokenMoving(movement('m2', 'completed'));
		token._onUpdateMovement(movement('m1', 'completed'), {}, {});
		expect(reports()).toEqual([]);
	});

	it('says nothing while Movement Tracking is off', () => {
		tracking = false;
		const completed = movement('m1', 'completed');
		tokenMoving(completed).token._onUpdateMovement(completed, {}, {});
		expect(reports()).toEqual([]);
	});
});
