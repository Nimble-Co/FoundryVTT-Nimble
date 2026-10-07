import { describe, expect, it } from 'vitest';
import { gainedPoolIdentifier } from './poolGain.js';

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
