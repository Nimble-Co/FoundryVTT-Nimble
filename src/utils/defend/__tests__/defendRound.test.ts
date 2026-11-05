import { beforeEach, describe, expect, it } from 'vitest';
import { roundMarkHolds } from '../defendRound.js';

type Globals = { game: Record<string, unknown> };

function setCombat(round: number, turn: number) {
	(globalThis as unknown as Globals).game = {
		combat: {
			id: 'combat',
			started: true,
			round,
			turn,
			turns: [{ id: 'ogre' }, { id: 'pip' }, { id: 'bram' }],
		},
	};
}

describe('roundMarkHolds', () => {
	beforeEach(() => setCombat(2, 0));

	it('holds until the hero turn begins, in this round or the next', () => {
		const mark = { combatId: 'combat', round: 2, turn: 0 };
		expect(roundMarkHolds(mark, 'pip')).toBe(true);
		setCombat(2, 1);
		expect(roundMarkHolds(mark, 'pip')).toBe(false);
	});

	it('made on the hero turn, holds through the round to the hero turn of the next', () => {
		const mark = { combatId: 'combat', round: 2, turn: 1 };
		setCombat(2, 2);
		expect(roundMarkHolds(mark, 'pip')).toBe(true);
		setCombat(3, 0);
		expect(roundMarkHolds(mark, 'pip')).toBe(true);
		setCombat(3, 1);
		expect(roundMarkHolds(mark, 'pip')).toBe(false);
	});

	it('does not hold in another combat, or with no mark', () => {
		expect(roundMarkHolds({ combatId: 'old', round: 2, turn: 0 }, 'pip')).toBe(false);
		expect(roundMarkHolds(null, 'pip')).toBe(false);
	});
});
