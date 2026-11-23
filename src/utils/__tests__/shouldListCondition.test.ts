import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import shouldListCondition from '../shouldListCondition.js';

describe('shouldListCondition', () => {
	beforeEach(() => {
		vi.stubGlobal('CONFIG', {
			NIMBLE: { monsterConditions: new Set(['latched', 'swallowed']) },
		});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('lists a general condition', () => {
		expect(shouldListCondition('prone')).toBe(true);
	});

	it('lists a condition the monster set does not mention, so custom GM conditions stay pickable', () => {
		expect(shouldListCondition('homebrewHexed')).toBe(true);
	});

	it('hides a monster-scoped condition the actor does not carry', () => {
		expect(shouldListCondition('latched')).toBe(false);
	});

	it('lists a monster-scoped condition the actor already carries, so it can be seen and cleared', () => {
		expect(shouldListCondition('latched', new Set(['latched']))).toBe(true);
	});

	it('still hides a monster-scoped condition when a different one is active', () => {
		expect(shouldListCondition('swallowed', new Set(['latched']))).toBe(false);
	});

	it('lists every condition when the monster set is missing', () => {
		(CONFIG.NIMBLE as { monsterConditions?: unknown }).monsterConditions = undefined;

		expect(shouldListCondition('latched')).toBe(true);
	});
});
