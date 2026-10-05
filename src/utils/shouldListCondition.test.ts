import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import shouldListCondition from './shouldListCondition.js';

describe('shouldListCondition', () => {
	beforeEach(() => {
		vi.stubGlobal('CONFIG', {
			NIMBLE: { conditionScopes: { latchedOn: 'monster', swallowed: 'monster' } },
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
		expect(shouldListCondition('latchedOn')).toBe(false);
	});

	it('lists a monster-scoped condition the actor already carries, so it can be seen and cleared', () => {
		expect(shouldListCondition('latchedOn', new Set(['latchedOn']))).toBe(true);
	});

	it('still hides a monster-scoped condition when a different one is active', () => {
		expect(shouldListCondition('swallowed', new Set(['latchedOn']))).toBe(false);
	});
});
