import { afterEach, describe, expect, it, vi } from 'vitest';
import { getSpacesMovedThisTurn } from './getSpacesMovedThisTurn.js';

const actor = { id: 'hero', isToken: false };

function stubCombat(combat: unknown): void {
	vi.stubGlobal('game', {
		...(globalThis as { game?: object }).game,
		combats: combat ? [combat] : [],
	});
}

function makeToken(
	history: { x: number; y: number; action: string }[],
	{ actorLink = true, gridReady = true } = {},
) {
	return {
		actorLink,
		parent: {
			id: 'scene-1',
			grid: gridReady ? { isGridless: false, distance: 1, measurePath: () => ({}) } : { type: 1 },
		},
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

function combatant(
	token: ReturnType<typeof makeToken> | null,
	actorId = 'hero',
	tokenId = 'tok-1',
) {
	return { actorId, tokenId, sceneId: 'scene-1', token };
}

const walk = (x: number, y: number) => ({ x, y, action: 'walk' });

describe('getSpacesMovedThisTurn', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('is null without a combat', () => {
		stubCombat(null);
		expect(getSpacesMovedThisTurn(actor)).toBeNull();
	});

	it('is null when the combat has not started', () => {
		stubCombat({ started: false, combatants: [combatant(makeToken([]))] });
		expect(getSpacesMovedThisTurn(actor)).toBeNull();
	});

	it('is null when the actor is not a combatant', () => {
		stubCombat({ started: true, combatants: [combatant(makeToken([]), 'other')] });
		expect(getSpacesMovedThisTurn(actor)).toBeNull();
	});

	it('reads the counted spaces from the combatant token history', () => {
		stubCombat({
			started: true,
			combatants: [combatant(makeToken([walk(0, 0), walk(3, 0), walk(3, 2)]))],
		});
		expect(getSpacesMovedThisTurn(actor)).toBe(5);
	});

	it('is zero for a combatant that has not moved', () => {
		stubCombat({ started: true, combatants: [combatant(makeToken([]))] });
		expect(getSpacesMovedThisTurn(actor)).toBe(0);
	});

	it('matches a synthetic token actor by its token, never by the shared actor id', () => {
		const unlinked = makeToken([walk(0, 0), walk(2, 0)], { actorLink: false });
		stubCombat({ started: true, combatants: [combatant(unlinked, 'hero', 'tok-9')] });
		const tokenActor = {
			id: 'hero',
			isToken: true,
			token: { id: 'tok-9', parent: { id: 'scene-1' } },
		};
		expect(getSpacesMovedThisTurn(tokenActor)).toBe(2);
		expect(getSpacesMovedThisTurn(actor)).toBeNull();
	});

	it('is null until the token scene has a grid to measure with', () => {
		stubCombat({
			started: true,
			combatants: [combatant(makeToken([walk(0, 0), walk(1, 0)], { gridReady: false }))],
		});
		expect(getSpacesMovedThisTurn(actor)).toBeNull();
	});
});
