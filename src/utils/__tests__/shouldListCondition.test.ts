import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import shouldListCondition from '../shouldListCondition.js';

describe('shouldListCondition', () => {
	beforeEach(() => {
		vi.stubGlobal('CONFIG', {
			NIMBLE: { conditionScopes: { latched: 'monster', swallowed: 'monster' } },
		});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('lists a general condition', () => {
		expect(shouldListCondition('prone')).toBe(true);
	});

	it('lists a condition the scope dictionary does not mention, so custom GM conditions stay pickable', () => {
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
});
