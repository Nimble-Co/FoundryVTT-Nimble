import { describe, expect, it } from 'vitest';

import { checkResult, checkResultOfCard } from '../checkResult.ts';

describe('checkResult', () => {
	describe.each(['save', 'skillCheck', 'abilityCheck'] as const)('a %s with a DC', (kind) => {
		it('succeeds on a total that meets the DC', () => {
			expect(checkResult({ kind, total: 14, keptD20: 10, dc: 14 })).toBe('succeeded');
		});

		it('succeeds on a total over the DC', () => {
			expect(checkResult({ kind, total: 15, keptD20: 10, dc: 14 })).toBe('succeeded');
		});

		it('fails on a total under the DC', () => {
			expect(checkResult({ kind, total: 13, keptD20: 10, dc: 14 })).toBe('failed');
		});
	});

	describe.each(['save', 'skillCheck'] as const)('a natural 1 or 20 on a %s', (kind) => {
		it('fails on a natural 1 that beats the DC', () => {
			expect(checkResult({ kind, total: 20, keptD20: 1, dc: 14 })).toBe('failed');
		});

		it('succeeds on a natural 20 under the DC', () => {
			expect(checkResult({ kind, total: 18, keptD20: 20, dc: 25 })).toBe('succeeded');
		});

		it('fails on a natural 1 with no DC', () => {
			expect(checkResult({ kind, total: 5, keptD20: 1, dc: null })).toBe('failed');
		});

		it('succeeds on a natural 20 with no DC', () => {
			expect(checkResult({ kind, total: 24, keptD20: 20 })).toBe('succeeded');
		});
	});

	describe('a natural 1 or 20 on an ability check', () => {
		const kind = 'abilityCheck';
		it('succeeds on a natural 1 that beats the DC', () => {
			expect(checkResult({ kind, total: 15, keptD20: 1, dc: 14 })).toBe('succeeded');
		});

		it('fails on a natural 20 under the DC', () => {
			expect(checkResult({ kind, total: 18, keptD20: 20, dc: 25 })).toBe('failed');
		});

		it('has no result with no DC', () => {
			expect(checkResult({ kind, total: 2, keptD20: 1, dc: null })).toBeNull();
			expect(checkResult({ kind, total: 24, keptD20: 20, dc: null })).toBeNull();
		});
	});

	describe('no DC and no natural 1 or 20', () => {
		it.each(['save', 'skillCheck', 'abilityCheck'] as const)('a %s has no result', (kind) => {
			expect(checkResult({ kind, total: 15, keptD20: 10, dc: null })).toBeNull();
			expect(checkResult({ kind, total: 15, keptD20: 10 })).toBeNull();
		});

		it('a roll with no kept d20 has no result', () => {
			expect(checkResult({ kind: 'save', total: 15, keptD20: null, dc: null })).toBeNull();
		});
	});

	it('a DC of 0 still is a DC', () => {
		expect(checkResult({ kind: 'skillCheck', total: 0, keptD20: 2, dc: 0 })).toBe('succeeded');
	});
});

describe('checkResultOfCard', () => {
	const roll = (d20: number, total: number) => ({
		total,
		terms: [{ faces: 20, results: [{ result: d20, active: true }] }],
	});

	it('reads the kind, the kept d20 and the DC of a save card', () => {
		const system = { saveKey: 'dexterity', dc: 14 };

		expect(checkResultOfCard('savingThrow', system, roll(5, 8))).toBe('failed');
		expect(checkResultOfCard('savingThrow', system, roll(10, 14))).toBe('succeeded');
	});

	it('tells nothing with no roll, no check card, or nothing that settles it', () => {
		expect(
			checkResultOfCard('savingThrow', { saveKey: 'dexterity', dc: 14 }, undefined),
		).toBeNull();
		expect(checkResultOfCard('chat', { dc: 14 }, roll(5, 8))).toBeNull();
		expect(checkResultOfCard('savingThrow', { saveKey: 'dexterity' }, roll(5, 8))).toBeNull();
	});
});
