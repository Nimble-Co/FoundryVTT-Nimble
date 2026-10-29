import { describe, expect, it } from 'vitest';
import { recoveryOf } from '../poolRecovery.ts';

describe('recoveryOf', () => {
	it('reads a turn start or a turn end recovery as once a round', () => {
		expect(recoveryOf(['onTurnStart'])).toBe('round');
		expect(recoveryOf(['onTurnEnd'])).toBe('round');
	});

	it('reads the encounter and the rests', () => {
		expect(recoveryOf(['encounterStart'])).toBe('encounter');
		expect(recoveryOf(['encounterEnd'])).toBe('encounter');
		expect(recoveryOf(['fieldRest'])).toBe('fieldRest');
		expect(recoveryOf(['safeRest'])).toBe('safeRest');
	});

	it('gives the most frequent recovery when a pool has more than one', () => {
		expect(recoveryOf(['safeRest', 'onTurnEnd'])).toBe('round');
		expect(recoveryOf(['safeRest', 'fieldRest'])).toBe('fieldRest');
	});

	it('gives nothing for a pool with no recovery', () => {
		expect(recoveryOf([])).toBe(null);
	});
});
