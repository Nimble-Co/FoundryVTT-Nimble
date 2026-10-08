import { afterEach, describe, expect, it } from 'vitest';
import { isInStartedCombat } from './isInStartedCombat.js';

const token = { id: 't1', parent: { id: 's1' } };

function combatHolding(tokenId: string, sceneId: string, started = true) {
	return { started, combatants: [{ tokenId, sceneId }] };
}

describe('isInStartedCombat', () => {
	const globals = globalThis as unknown as { game: { combats?: unknown } };
	const originalCombats = globals.game.combats;

	afterEach(() => {
		globals.game.combats = originalCombats;
	});

	it('finds the token in a started combat that is not the first', () => {
		const combats = [combatHolding('other', 's1'), combatHolding('t1', 's1')];
		expect(isInStartedCombat(token, combats)).toBe(true);
	});

	it('ignores a combat that has not started', () => {
		expect(isInStartedCombat(token, [combatHolding('t1', 's1', false)])).toBe(false);
	});

	it('ignores a combatant with the same token id on another scene', () => {
		expect(isInStartedCombat(token, [combatHolding('t1', 's2')])).toBe(false);
	});

	it('reads every combat in the world by default', () => {
		globals.game.combats = [combatHolding('other', 's1'), combatHolding('t1', 's1')];
		expect(isInStartedCombat(token)).toBe(true);
	});

	it('is false when the world has no combats', () => {
		globals.game.combats = undefined;
		expect(isInStartedCombat(token)).toBe(false);
	});
});
