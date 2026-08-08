import { beforeEach, describe, expect, it } from 'vitest';
import isTokenDefeated from './isTokenDefeated.js';

function tokenWithStatuses(statuses: Set<string> | undefined): Token {
	return { actor: statuses ? { statuses } : undefined } as unknown as Token;
}

describe('isTokenDefeated', () => {
	beforeEach(() => {
		(globalThis as { CONFIG?: Record<string, unknown> }).CONFIG = {
			specialStatusEffects: { DEFEATED: 'dead' },
		};
	});

	it('reports a token carrying the defeated status', () => {
		expect(isTokenDefeated(tokenWithStatuses(new Set(['dead'])))).toBe(true);
	});

	it('does not report a token carrying unrelated statuses', () => {
		expect(isTokenDefeated(tokenWithStatuses(new Set(['bloodied'])))).toBe(false);
	});

	it('does not report a token with no statuses', () => {
		expect(isTokenDefeated(tokenWithStatuses(new Set()))).toBe(false);
	});

	it('does not report a token with no actor', () => {
		expect(isTokenDefeated(tokenWithStatuses(undefined))).toBe(false);
	});

	it('does not throw when the defeated status is unconfigured', () => {
		(globalThis as { CONFIG?: Record<string, unknown> }).CONFIG = { specialStatusEffects: {} };

		expect(isTokenDefeated(tokenWithStatuses(new Set(['dead'])))).toBe(false);
	});
});
