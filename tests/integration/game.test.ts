/**
 * Harness smoke test: proves the pool joined a live Foundry world and that
 * test files execute against the real `game` global. Runs in the Foundry page.
 */

import { describe, expect, test } from 'vitest';
import { SYSTEM_ID } from '#system';

describe('live Foundry world', () => {
	test('game is ready', () => {
		expect(game.ready).toBe(true);
	});

	test('the Nimble system is active', () => {
		expect(game.system.id).toBe(SYSTEM_ID);
	});

	test('the core generation is 14', () => {
		expect(game.release.generation).toBe(14);
	});
});
