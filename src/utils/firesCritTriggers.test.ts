import { describe, expect, it } from 'vitest';
import { firesCritTriggers } from './firesCritTriggers.js';

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
