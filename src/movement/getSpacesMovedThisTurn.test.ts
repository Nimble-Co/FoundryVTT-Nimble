import { afterEach, describe, expect, it, vi } from 'vitest';
import { getSpacesMovedThisTurn } from './getSpacesMovedThisTurn.js';

const actor = { id: 'hero' };

function stubCombat(combat: unknown): void {
	vi.stubGlobal('game', { ...(globalThis as { game?: object }).game, combat });
}

function makeToken(history: { x: number; y: number; action: string }[]) {
	return {
		parent: { grid: { isGridless: false, distance: 1 } },
		movementHistory: history,
		measureMovementPath(waypoints: { x: number; y: number }[]) {
			const segments: { spaces: number; distance: number }[] = [];
			for (let i = 1; i < waypoints.length; i++) {
				const dx = Math.abs(waypoints[i].x - waypoints[i - 1].x);
				const dy = Math.abs(waypoints[i].y - waypoints[i - 1].y);
				segments.push({ spaces: Math.max(dx, dy), distance: Math.max(dx, dy) });
			}
			return { segments };
		},
	};
}

describe('getSpacesMovedThisTurn', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('is null without a combat', () => {
		stubCombat(null);
		expect(getSpacesMovedThisTurn(actor)).toBeNull();
	});

	it('is null when the combat has not started', () => {
		stubCombat({ started: false, combatants: [{ actor, token: makeToken([]) }] });
		expect(getSpacesMovedThisTurn(actor)).toBeNull();
	});

	it('is null when the actor is not a combatant', () => {
		stubCombat({ started: true, combatants: [{ actor: { id: 'other' }, token: makeToken([]) }] });
		expect(getSpacesMovedThisTurn(actor)).toBeNull();
	});

	it('reads the counted spaces from the combatant token history', () => {
		const token = makeToken([
			{ x: 0, y: 0, action: 'walk' },
			{ x: 4, y: 0, action: 'walk' },
		]);
		stubCombat({ started: true, combatants: [{ actor, token }] });
		expect(getSpacesMovedThisTurn(actor)).toBe(4);
	});

	it('is zero for a combatant that has not moved', () => {
		stubCombat({ started: true, combatants: [{ actor, token: makeToken([]) }] });
		expect(getSpacesMovedThisTurn(actor)).toBe(0);
	});
});
