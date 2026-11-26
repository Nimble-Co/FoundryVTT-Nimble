import { describe, expect, it } from 'vitest';
import { gainedChargePoolIdentifier, gainedPoolIdentifier } from '../poolGain.js';

describe('gainedPoolIdentifier', () => {
	it('names the pool that holds more dice than before', () => {
		expect(gainedPoolIdentifier({ poolId: 'fury', previousFaces: [2], newFaces: [2, 4] })).toBe(
			'fury',
		);
	});

	it('strips the prefix of an actor-scoped pool', () => {
		expect(gainedPoolIdentifier({ poolId: 'actor:fury', previousFaces: [], newFaces: [3] })).toBe(
			'fury',
		);
	});

	it('is no gain when the pool holds the same number of dice or fewer', () => {
		expect(gainedPoolIdentifier({ poolId: 'fury', previousFaces: [2], newFaces: [5] })).toBeNull();
		expect(
			gainedPoolIdentifier({ poolId: 'fury', previousFaces: [2, 4], newFaces: [2] }),
		).toBeNull();
	});

	it('is no gain when spent dice were refunded', () => {
		expect(
			gainedPoolIdentifier({ poolId: 'fury', previousFaces: [], newFaces: [3], reason: 'refund' }),
		).toBeNull();
	});

	it('is no gain for no payload', () => {
		expect(gainedPoolIdentifier(null)).toBeNull();
	});
});

describe('gainedChargePoolIdentifier', () => {
	it('names the bare identifier of the pool whose count rose', () => {
		expect(
			gainedChargePoolIdentifier({ poolId: 'actor:thrill', previousValue: 1, newValue: 3 }),
		).toBe('thrill');
		expect(gainedChargePoolIdentifier({ poolId: 'focus', previousValue: 0, newValue: 1 })).toBe(
			'focus',
		);
	});

	it('is no gain when the count stays or drops, or a value is missing', () => {
		expect(
			gainedChargePoolIdentifier({ poolId: 'focus', previousValue: 2, newValue: 2 }),
		).toBeNull();
		expect(
			gainedChargePoolIdentifier({ poolId: 'focus', previousValue: 2, newValue: 0 }),
		).toBeNull();
		expect(gainedChargePoolIdentifier({ poolId: 'focus', newValue: 1 })).toBeNull();
		expect(gainedChargePoolIdentifier(null)).toBeNull();
	});

	it('is no gain for a dice-pool payload', () => {
		expect(
			gainedChargePoolIdentifier({ poolId: 'fury', previousFaces: [], newFaces: [4] } as never),
		).toBeNull();
	});

	it('is no gain when no identifier is left', () => {
		expect(
			gainedChargePoolIdentifier({ poolId: 'actor:', previousValue: 0, newValue: 1 }),
		).toBeNull();
	});
});
