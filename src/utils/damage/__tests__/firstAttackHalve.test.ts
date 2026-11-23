import { describe, expect, it } from 'vitest';
import { decideFirstAttackHalve, readFirstAttackHalveStamp } from '../firstAttackHalve.js';

const combat = { combatId: 'combat-1', round: 1 };

describe('decideFirstAttackHalve', () => {
	it('halves the first hit of the round', () => {
		expect(
			decideFirstAttackHalve({
				hasRule: true,
				stamp: null,
				...combat,
				messageId: 'msg-1',
			}),
		).toBe(true);
	});

	it('does not halve a second hit in the same round', () => {
		expect(
			decideFirstAttackHalve({
				hasRule: true,
				stamp: { ...combat, messageId: 'msg-1' },
				...combat,
				messageId: 'msg-2',
			}),
		).toBe(false);
	});

	it('halves the first hit of the next round', () => {
		expect(
			decideFirstAttackHalve({
				hasRule: true,
				stamp: { combatId: 'combat-1', round: 1, messageId: 'msg-1' },
				combatId: 'combat-1',
				round: 2,
				messageId: 'msg-3',
			}),
		).toBe(true);
	});

	it('still halves the card that already used the halve', () => {
		expect(
			decideFirstAttackHalve({
				hasRule: true,
				stamp: { ...combat, messageId: 'msg-1' },
				...combat,
				messageId: 'msg-1',
			}),
		).toBe(true);
	});

	it('halves again in a different combat and after the stamp is cleared', () => {
		expect(
			decideFirstAttackHalve({
				hasRule: true,
				stamp: { ...combat, messageId: 'msg-1' },
				combatId: 'combat-2',
				round: 1,
				messageId: 'msg-4',
			}),
		).toBe(true);
		expect(
			decideFirstAttackHalve({
				hasRule: true,
				stamp: null,
				...combat,
				messageId: 'msg-5',
			}),
		).toBe(true);
	});

	it('does not halve without the rule, a started combat, or a card id', () => {
		expect(
			decideFirstAttackHalve({ hasRule: false, stamp: null, ...combat, messageId: 'msg-1' }),
		).toBe(false);
		expect(
			decideFirstAttackHalve({
				hasRule: true,
				stamp: null,
				combatId: null,
				round: null,
				messageId: 'msg-1',
			}),
		).toBe(false);
		expect(decideFirstAttackHalve({ hasRule: true, stamp: null, ...combat, messageId: null })).toBe(
			false,
		);
	});
});

describe('readFirstAttackHalveStamp', () => {
	it('reads a complete stamp and ignores anything else', () => {
		const stamp = { combatId: 'combat-1', round: 2, messageId: 'msg-1' };
		expect(readFirstAttackHalveStamp({ getFlag: () => stamp })).toEqual(stamp);
		expect(readFirstAttackHalveStamp({ getFlag: () => ({ combatId: 'combat-1' }) })).toBeNull();
		expect(readFirstAttackHalveStamp({})).toBeNull();
	});
});
