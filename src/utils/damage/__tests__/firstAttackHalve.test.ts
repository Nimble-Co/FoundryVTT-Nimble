import { describe, expect, it } from 'vitest';
import { decideFirstAttackHalve, readFirstAttackHalveStamp } from '../firstAttackHalve.js';

const combatId = 'combat-1';

describe('decideFirstAttackHalve', () => {
	it('halves the first attack since the stamp was cleared', () => {
		expect(decideFirstAttackHalve({ stamp: null, combatId, messageId: 'msg-1' })).toBe(true);
	});

	it('does not halve a second attack before the stamp is cleared', () => {
		expect(
			decideFirstAttackHalve({
				stamp: { combatId, messageId: 'msg-1' },
				combatId,
				messageId: 'msg-2',
			}),
		).toBe(false);
	});

	it('does not halve a second attack when the combat round changes, only when the stamp is cleared', () => {
		expect(
			decideFirstAttackHalve({
				stamp: { combatId, messageId: 'msg-1' },
				combatId,
				messageId: 'msg-3',
			}),
		).toBe(false);
	});

	it('still halves the card that already used the halve', () => {
		expect(
			decideFirstAttackHalve({
				stamp: { combatId, messageId: 'msg-1' },
				combatId,
				messageId: 'msg-1',
			}),
		).toBe(true);
	});

	it('halves again in a different combat', () => {
		expect(
			decideFirstAttackHalve({
				stamp: { combatId, messageId: 'msg-1' },
				combatId: 'combat-2',
				messageId: 'msg-4',
			}),
		).toBe(true);
	});

	it('does not halve without a started combat or a card id', () => {
		expect(decideFirstAttackHalve({ stamp: null, combatId: null, messageId: 'msg-1' })).toBe(false);
		expect(decideFirstAttackHalve({ stamp: null, combatId, messageId: null })).toBe(false);
	});
});

describe('readFirstAttackHalveStamp', () => {
	it('reads a complete stamp and ignores anything else', () => {
		const stamp = { combatId, messageId: 'msg-1' };
		const actorWith = (value: unknown) => ({ getFlag: () => value });
		expect(readFirstAttackHalveStamp(actorWith(stamp))).toEqual(stamp);
		expect(readFirstAttackHalveStamp(actorWith({ ...stamp, round: 2 }))).toEqual(stamp);
		expect(readFirstAttackHalveStamp(actorWith({ combatId }))).toBeNull();
		expect(readFirstAttackHalveStamp(actorWith(undefined))).toBeNull();
	});
});
