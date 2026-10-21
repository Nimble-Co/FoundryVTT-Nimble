import { describe, expect, it } from 'vitest';
import { critTriggerOutcome, firesCritTriggers } from './firesCritTriggers.js';

describe('firesCritTriggers', () => {
	it('fires for a crit', () => {
		expect(firesCritTriggers({ isCritical: true })).toBe(true);
	});

	it('fires for a discarded crit whose reroll keeps its crit triggers', () => {
		expect(firesCritTriggers({ isCritical: false, discardedCritTriggers: true })).toBe(true);
	});

	it('does not fire otherwise', () => {
		expect(firesCritTriggers({ isCritical: false, discardedCritTriggers: false })).toBe(false);
		expect(firesCritTriggers({})).toBe(false);
	});
});

describe('critTriggerOutcome', () => {
	it('counts a discarded crit that still triggers as a crit that landed', () => {
		expect(critTriggerOutcome({ isMiss: true, discardedCritTriggers: true })).toEqual({
			isCritical: true,
			isMiss: false,
		});
	});

	it('keeps a miss and drops a crit flag that is not set', () => {
		expect(critTriggerOutcome({ isMiss: true })).toEqual({ isCritical: false, isMiss: true });
		expect(critTriggerOutcome({})).toEqual({ isCritical: false, isMiss: false });
	});
});
