import { describe, expect, it } from 'vitest';
import { NimbleRoll } from './NimbleRoll.ts';

type MockDieTerm = {
	faces: number;
	results: { active: boolean; discarded?: boolean; result: number }[];
};

function makeDieTerm(faces: number, result: number, active = true, discarded = false): MockDieTerm {
	return { faces, results: [{ result, active, discarded }] };
}

function makeRoll(formula: string, terms: MockDieTerm[], evaluated = true): NimbleRoll {
	const roll = new NimbleRoll(formula, {});
	(roll as unknown as { terms: unknown[]; _evaluated: boolean }).terms = terms;
	(roll as unknown as { _evaluated: boolean })._evaluated = evaluated;
	return roll;
}

describe('NimbleRoll', () => {
	describe('constructor defaults', () => {
		it('should default prompted to false', () => {
			const roll = new NimbleRoll('1d20', {});
			expect(roll.data.prompted).toBe(false);
		});

		it('should default respondentId to null', () => {
			const roll = new NimbleRoll('1d20', {});
			expect(roll.data.respondentId).toBe(null);
		});

		it('should preserve provided prompted value', () => {
			const roll = new NimbleRoll('1d20', { prompted: true });
			expect(roll.data.prompted).toBe(true);
		});

		it('should preserve provided respondentId value', () => {
			const roll = new NimbleRoll('1d20', { respondentId: 'actor-123' });
			expect(roll.data.respondentId).toBe('actor-123');
		});
	});

	describe('toJSON', () => {
		it('should include data in JSON output', () => {
			const roll = new NimbleRoll('1d20', { prompted: true, respondentId: 'actor-abc' });
			const json = roll.toJSON() as Record<string, unknown>;
			expect(json.data).toEqual(
				expect.objectContaining({ prompted: true, respondentId: 'actor-abc' }),
			);
		});

		it('should include default data in JSON output when no data provided', () => {
			const roll = new NimbleRoll('1d20');
			const json = roll.toJSON() as Record<string, unknown>;
			expect(json.data).toEqual(expect.objectContaining({ prompted: false, respondentId: null }));
		});
	});

	describe('isCriticalSuccess', () => {
		it('should return undefined when not yet evaluated', () => {
			const roll = makeRoll('1d20', [makeDieTerm(20, 20)], false);
			expect(roll.isCriticalSuccess).toBeUndefined();
		});

		it('should return true when the active die result equals the die faces (natural max)', () => {
			const roll = makeRoll('1d20', [makeDieTerm(20, 20)]);
			expect(roll.isCriticalSuccess).toBe(true);
		});

		it('should return false when the die result is below the maximum', () => {
			const roll = makeRoll('1d20', [makeDieTerm(20, 15)]);
			expect(roll.isCriticalSuccess).toBe(false);
		});

		it('should return false when the die result is 1', () => {
			const roll = makeRoll('1d20', [makeDieTerm(20, 1)]);
			expect(roll.isCriticalSuccess).toBe(false);
		});

		it('should return false when the max-value result is discarded', () => {
			const roll = makeRoll('1d20', [makeDieTerm(20, 20, true, true)]);
			expect(roll.isCriticalSuccess).toBe(false);
		});

		it('should return false when the max-value result is not active', () => {
			const roll = makeRoll('1d20', [makeDieTerm(20, 20, false)]);
			expect(roll.isCriticalSuccess).toBe(false);
		});

		it('should return undefined when there are no die terms', () => {
			const roll = makeRoll('5', []);
			expect(roll.isCriticalSuccess).toBeUndefined();
		});

		it('should work for non-d20 dice (e.g. d6 rolls max face)', () => {
			const roll = makeRoll('1d6', [makeDieTerm(6, 6)]);
			expect(roll.isCriticalSuccess).toBe(true);
		});
	});

	describe('isCriticalFailure', () => {
		it('should return undefined when not yet evaluated', () => {
			const roll = makeRoll('1d20', [makeDieTerm(20, 1)], false);
			expect(roll.isCriticalFailure).toBeUndefined();
		});

		it('should return true when the active die result is 1', () => {
			const roll = makeRoll('1d20', [makeDieTerm(20, 1)]);
			expect(roll.isCriticalFailure).toBe(true);
		});

		it('should return false when the die result is above 1', () => {
			const roll = makeRoll('1d20', [makeDieTerm(20, 10)]);
			expect(roll.isCriticalFailure).toBe(false);
		});

		it('should return false when the die result is 20', () => {
			const roll = makeRoll('1d20', [makeDieTerm(20, 20)]);
			expect(roll.isCriticalFailure).toBe(false);
		});

		it('should return false when the 1-result is discarded', () => {
			const roll = makeRoll('1d20', [makeDieTerm(20, 1, true, true)]);
			expect(roll.isCriticalFailure).toBe(false);
		});

		it('should return false when the 1-result is not active', () => {
			const roll = makeRoll('1d20', [makeDieTerm(20, 1, false)]);
			expect(roll.isCriticalFailure).toBe(false);
		});

		it('should return undefined when there are no die terms', () => {
			const roll = makeRoll('5', []);
			expect(roll.isCriticalFailure).toBeUndefined();
		});
	});

	describe('mutual exclusivity', () => {
		it('should not simultaneously be critical success and critical failure', () => {
			const rollMax = makeRoll('1d20', [makeDieTerm(20, 20)]);
			const rollMin = makeRoll('1d20', [makeDieTerm(20, 1)]);
			expect(rollMax.isCriticalSuccess && rollMax.isCriticalFailure).toBeFalsy();
			expect(rollMin.isCriticalSuccess && rollMin.isCriticalFailure).toBeFalsy();
		});

		it('natural 20 is critical success and not critical failure', () => {
			const roll = makeRoll('1d20', [makeDieTerm(20, 20)]);
			expect(roll.isCriticalSuccess).toBe(true);
			expect(roll.isCriticalFailure).toBe(false);
		});

		it('natural 1 is critical failure and not critical success', () => {
			const roll = makeRoll('1d20', [makeDieTerm(20, 1)]);
			expect(roll.isCriticalSuccess).toBe(false);
			expect(roll.isCriticalFailure).toBe(true);
		});
	});

	describe('fromRoll static method', () => {
		it('should create a NimbleRoll from another roll', () => {
			const original = new NimbleRoll('1d20', { prompted: true, respondentId: 'actor-1' });
			const copied = NimbleRoll.fromRoll(original);
			expect(copied).toBeInstanceOf(NimbleRoll);
			expect(copied.formula).toBe('1d20');
			expect(copied.data.prompted).toBe(true);
			expect(copied.data.respondentId).toBe('actor-1');
		});
	});
});
