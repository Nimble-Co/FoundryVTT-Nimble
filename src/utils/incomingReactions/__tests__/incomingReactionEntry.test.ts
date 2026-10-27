import { describe, expect, it } from 'vitest';
import { rerollTriggerMatches } from '../incomingReactionEntry.js';

describe('rerollTriggerMatches', () => {
	const crit = { isCritical: true, isMiss: false };
	const hit = { isCritical: false, isMiss: false };
	const miss = { isCritical: false, isMiss: true };

	it('matches a hit that is not a crit', () => {
		expect(rerollTriggerMatches('nonCriticalHit', hit)).toBe(true);
		expect(rerollTriggerMatches('nonCriticalHit', crit)).toBe(false);
		expect(rerollTriggerMatches('nonCriticalHit', miss)).toBe(false);
	});

	it('matches a miss', () => {
		expect(rerollTriggerMatches('miss', miss)).toBe(true);
		expect(rerollTriggerMatches('miss', hit)).toBe(false);
		expect(rerollTriggerMatches('miss', crit)).toBe(false);
	});

	it('still counts a crit as a hit', () => {
		expect(rerollTriggerMatches('hit', crit)).toBe(true);
	});
});
