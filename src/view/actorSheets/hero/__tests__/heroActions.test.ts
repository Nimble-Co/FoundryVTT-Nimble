import { describe, expect, it } from 'vitest';
import { baseMaxActions, mayAddAction } from '../heroActions.js';

describe('the action max of the character sheet', () => {
	it('adds what the rules of the creature add', () => {
		expect(baseMaxActions({ max: 3 })).toBe(3);
		expect(baseMaxActions({ max: 3 }, 1)).toBe(4);
		expect(baseMaxActions({ max: 0 }, 1)).toBe(4);
	});

	it('counts the bonus toward the 10 actions of a turn', () => {
		expect(mayAddAction({ max: 3 }, 6)).toBe(true);
		expect(mayAddAction({ max: 3 }, 6, 1)).toBe(false);
	});
});
