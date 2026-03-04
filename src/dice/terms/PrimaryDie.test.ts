import { describe, expect, it } from 'vitest';
import { PrimaryDie } from './PrimaryDie.js';

describe('PrimaryDie', () => {
	describe('exploded getter', () => {
		it('should return undefined when not evaluated', () => {
			const die = new PrimaryDie({ number: 1, faces: 6 });
			expect(die.exploded).toBeUndefined();
		});

		it('should return true when active die result exploded', () => {
			const die = new PrimaryDie({ number: 1, faces: 6 });
			// Simulate evaluated state with an exploded result
			(die as any)._evaluated = true;
			die.results = [
				{ result: 6, active: true, discarded: false, exploded: true },
				{ result: 4, active: true, discarded: false, exploded: false },
			];

			expect(die.exploded).toBe(true);
		});

		it('should return false when no results exploded', () => {
			const die = new PrimaryDie({ number: 1, faces: 6 });
			(die as any)._evaluated = true;
			die.results = [{ result: 3, active: true, discarded: false, exploded: false }];

			expect(die.exploded).toBe(false);
		});

		/**
		 * Bug #369: Weapons with multiple dice can both hit, crit and miss all at the same time
		 *
		 * When rolling with advantage (kh1), if the discarded die rolled max and exploded,
		 * the `exploded` getter incorrectly returns true even though that die was discarded.
		 * This causes the roll to show as both a crit AND potentially a miss if the kept die rolled 1.
		 */
		it('should return false when only discarded die result exploded (Bug #369)', () => {
			const die = new PrimaryDie({ number: 2, faces: 6 });
			(die as any)._evaluated = true;
			// Scenario: 2d6kh1 - rolled [6, 3], kept the 6, but the 3 was actually kept
			// Wait, let's do it correctly:
			// Scenario: 2d6kl1 (disadvantage) - rolled [6, 1]
			// The 6 exploded but was discarded (kl keeps the 1)
			// The 1 is kept and is a miss
			// Bug: exploded returns true because it checks ALL results, not just active ones
			die.results = [
				{ result: 6, active: false, discarded: true, exploded: true }, // Discarded - rolled max
				{ result: 1, active: true, discarded: false, exploded: false }, // Kept - this is a miss
			];

			// Before fix: this returns true (BUG)
			// After fix: this should return false (correct)
			expect(die.exploded).toBe(false);
		});

		it('should return true when kept die exploded even if discarded die also exploded', () => {
			const die = new PrimaryDie({ number: 2, faces: 6 });
			(die as any)._evaluated = true;
			// Both dice rolled 6 and exploded, but only one is kept
			die.results = [
				{ result: 6, active: true, discarded: false, exploded: true }, // Kept
				{ result: 6, active: false, discarded: true, exploded: true }, // Discarded
			];

			expect(die.exploded).toBe(true);
		});

		it('should handle advantage scenario correctly', () => {
			const die = new PrimaryDie({ number: 2, faces: 6 });
			(die as any)._evaluated = true;
			// Advantage (kh1): rolled [3, 6], keep highest (6)
			die.results = [
				{ result: 3, active: false, discarded: true, exploded: false }, // Discarded
				{ result: 6, active: true, discarded: false, exploded: true }, // Kept - crit
			];

			expect(die.exploded).toBe(true);
		});

		it('should handle disadvantage with discarded crit correctly', () => {
			const die = new PrimaryDie({ number: 2, faces: 6 });
			(die as any)._evaluated = true;
			// Disadvantage (kl1): rolled [6, 2], keep lowest (2)
			// The 6 exploded but was discarded
			die.results = [
				{ result: 6, active: false, discarded: true, exploded: true }, // Discarded - was a crit
				{ result: 2, active: true, discarded: false, exploded: false }, // Kept - normal hit
			];

			// Should NOT be a crit because the kept die didn't explode
			expect(die.exploded).toBe(false);
		});
	});

	describe('isMiss getter', () => {
		it('should return undefined when not evaluated', () => {
			const die = new PrimaryDie({ number: 1, faces: 6 });
			expect(die.isMiss).toBeUndefined();
		});

		it('should return true when active die result is 1', () => {
			const die = new PrimaryDie({ number: 1, faces: 6 });
			(die as any)._evaluated = true;
			die.results = [{ result: 1, active: true, discarded: false, exploded: false }];

			expect(die.isMiss).toBe(true);
		});

		it('should return false when active die result is not 1', () => {
			const die = new PrimaryDie({ number: 1, faces: 6 });
			(die as any)._evaluated = true;
			die.results = [{ result: 4, active: true, discarded: false, exploded: false }];

			expect(die.isMiss).toBe(false);
		});

		it('should return false when only discarded die rolled 1', () => {
			const die = new PrimaryDie({ number: 2, faces: 6 });
			(die as any)._evaluated = true;
			// Advantage (kh1): rolled [1, 4], keep highest (4)
			die.results = [
				{ result: 1, active: false, discarded: true, exploded: false }, // Discarded miss
				{ result: 4, active: true, discarded: false, exploded: false }, // Kept hit
			];

			expect(die.isMiss).toBe(false);
		});

		it('should return true when kept die rolled 1 with disadvantage', () => {
			const die = new PrimaryDie({ number: 2, faces: 6 });
			(die as any)._evaluated = true;
			// Disadvantage (kl1): rolled [4, 1], keep lowest (1)
			die.results = [
				{ result: 4, active: false, discarded: true, exploded: false }, // Discarded
				{ result: 1, active: true, discarded: false, exploded: false }, // Kept - miss
			];

			expect(die.isMiss).toBe(true);
		});

		it('should return false for exploded results even if they rolled 1 after explosion', () => {
			const die = new PrimaryDie({ number: 1, faces: 6 });
			(die as any)._evaluated = true;
			// Rolled 6 (crit, explodes), then rolled 1 on the explosion
			// The explosion result has exploded: false because 1 doesn't trigger another explosion
			die.results = [
				{ result: 6, active: true, discarded: false, exploded: true }, // Original crit - triggered explosion
				{ result: 1, active: true, discarded: false, exploded: false }, // Explosion result - rolled 1, no further explosion
			];

			// This is a crit (the primary die exploded), NOT a miss
			// Even though the explosion rolled 1, the attack was still a crit
			expect(die.isMiss).toBe(false);
			expect(die.exploded).toBe(true);
		});

		it('should return false when crit explodes and explosion rolls 1 (real scenario)', () => {
			const die = new PrimaryDie({ number: 1, faces: 6 });
			(die as any)._evaluated = true;
			// Real scenario from crossbow crit:
			// Primary die rolled 6 (max), triggered explosion
			// Explosion die rolled 1
			// UI was incorrectly showing both CRIT and MISS
			die.results = [
				{ result: 6, active: true, discarded: false, exploded: true },
				{ result: 1, active: true, discarded: false, exploded: false },
			];

			expect(die.exploded).toBe(true); // It's a crit
			expect(die.isMiss).toBe(false); // NOT a miss - the explosion result doesn't count
		});
	});

	describe('Bug #369 - simultaneous crit and miss display', () => {
		it('should not show both crit and miss when disadvantage discards exploded die', () => {
			const die = new PrimaryDie({ number: 2, faces: 6 });
			(die as any)._evaluated = true;
			// The exact bug scenario:
			// Disadvantage roll (kl1): rolled [6, 1]
			// Die 1: rolled 6, exploded (but discarded due to kl)
			// Die 2: rolled 1, kept (this is the miss)
			die.results = [
				{ result: 6, active: false, discarded: true, exploded: true },
				{ result: 1, active: true, discarded: false, exploded: false },
			];

			// The bug causes both to be true simultaneously
			expect(die.exploded).toBe(false); // Should be false - kept die didn't explode
			expect(die.isMiss).toBe(true); // Should be true - kept die rolled 1

			// They should never both be true for the same roll
			expect(die.exploded && die.isMiss).toBe(false);
		});

		it('should correctly identify crit when kept die explodes', () => {
			const die = new PrimaryDie({ number: 2, faces: 6 });
			(die as any)._evaluated = true;
			// Advantage roll (kh1): rolled [2, 6]
			die.results = [
				{ result: 2, active: false, discarded: true, exploded: false },
				{ result: 6, active: true, discarded: false, exploded: true },
			];

			expect(die.exploded).toBe(true);
			expect(die.isMiss).toBe(false);
		});

		it('should correctly identify miss when kept die rolls 1', () => {
			const die = new PrimaryDie({ number: 2, faces: 6 });
			(die as any)._evaluated = true;
			// Disadvantage roll (kl1): rolled [4, 1]
			die.results = [
				{ result: 4, active: false, discarded: true, exploded: false },
				{ result: 1, active: true, discarded: false, exploded: false },
			];

			expect(die.exploded).toBe(false);
			expect(die.isMiss).toBe(true);
		});

		it('should correctly identify normal hit', () => {
			const die = new PrimaryDie({ number: 2, faces: 6 });
			(die as any)._evaluated = true;
			// Advantage roll (kh1): rolled [2, 4]
			die.results = [
				{ result: 2, active: false, discarded: true, exploded: false },
				{ result: 4, active: true, discarded: false, exploded: false },
			];

			expect(die.exploded).toBe(false);
			expect(die.isMiss).toBe(false);
		});
	});
});
