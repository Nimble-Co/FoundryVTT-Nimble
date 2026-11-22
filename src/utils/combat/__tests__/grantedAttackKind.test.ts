import { describe, expect, it } from 'vitest';
import { grantedAttackKind } from '../grantedAttackKind.ts';

describe('grantedAttackKind', () => {
	it('gives the kind of a line from what it spends', () => {
		expect(grantedAttackKind({ free: true, spendsReaction: false })).toBe('free');
		expect(grantedAttackKind({ free: false, spendsReaction: false })).toBe('action');
		expect(grantedAttackKind({ free: false, spendsReaction: true })).toBe('reaction');
	});

	it('makes a free line that spends the reaction a free opportunity attack', () => {
		expect(grantedAttackKind({ free: true, spendsReaction: true })).toBe('freeOpportunity');
	});
});
