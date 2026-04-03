import { describe, expect, it } from 'vitest';
import { isCombatStarted } from './isCombatStarted.js';

describe('isCombatStarted', () => {
	it('returns the explicit started flag when present', () => {
		expect(
			isCombatStarted({
				started: false,
				round: 3,
			} as Combat),
		).toBe(false);
		expect(
			isCombatStarted({
				started: true,
				round: 0,
			} as Combat),
		).toBe(true);
	});

	it('falls back to round state when the started flag is unavailable', () => {
		expect(
			isCombatStarted({
				round: 0,
			} as Combat),
		).toBe(false);
		expect(
			isCombatStarted({
				round: 1,
			} as Combat),
		).toBe(true);
		expect(isCombatStarted(null)).toBe(false);
	});
});
