import { describe, expect, it } from 'vitest';
import type { MutatedResult, MutationStep } from './mutations.js';
import { applyMutationStep } from './mutations.js';
import { NIMBLE_MODS } from './nimbleDieModifiers.js';

const Terms = foundry.dice.terms;

/** Create a mock Die term with pre-set results. */
function makeDie(
	faces: number,
	results: Array<{ result: number; active?: boolean; discarded?: boolean }>,
	modifiers: string[] = [],
): foundry.dice.terms.Die {
	// Cast modifiers to satisfy Foundry's stricter TermData typing in tests
	const die = new Terms.Die({ faces, number: results.length, modifiers } as any);
	(die as any).results = results.map((r) => ({
		result: r.result,
		active: r.active ?? true,
		discarded: r.discarded ?? false,
	}));
	return die;
}

describe('applyMutationStep', () => {
	describe('set operation', () => {
		it('sets result to exact value and tags metadata', () => {
			const die = makeDie(8, [{ result: 3 }]);
			const step: MutationStep = {
				target: { kind: 'all' },
				operation: { type: 'set', value: 7 },
				source: 'Test',
			};
			applyMutationStep(step, [die], undefined);

			expect(die.results[0].result).toBe(7);
			const m = (die.results[0] as MutatedResult).mutation;
			expect(m).toBeDefined();
			expect(m!.rolledValue).toBe(3);
			expect(m!.source).toBe('Test');
			expect(m!.countsAsCrit).toBe(false);
			expect(m!.triggersExplosion).toBe(false);
		});

		it('clamps set value to [1, faces]', () => {
			const die = makeDie(6, [{ result: 4 }]);
			applyMutationStep(
				{ target: { kind: 'all' }, operation: { type: 'set', value: 10 } },
				[die],
				undefined,
			);
			expect(die.results[0].result).toBe(6);

			const die2 = makeDie(6, [{ result: 4 }]);
			applyMutationStep(
				{ target: { kind: 'all' }, operation: { type: 'set', value: 0 } },
				[die2],
				undefined,
			);
			expect(die2.results[0].result).toBe(1);
		});
	});

	describe('bump operation', () => {
		it('increments result by delta', () => {
			const die = makeDie(8, [{ result: 5 }]);
			applyMutationStep(
				{
					target: { kind: 'all' },
					operation: { type: 'bump', delta: 1 },
					source: 'Juggernaut',
				},
				[die],
				undefined,
			);
			expect(die.results[0].result).toBe(6);
			expect((die.results[0] as MutatedResult).mutation!.rolledValue).toBe(5);
		});

		it('clamps bump at faces (max)', () => {
			const die = makeDie(8, [{ result: 8 }]);
			applyMutationStep(
				{ target: { kind: 'all' }, operation: { type: 'bump', delta: 1 } },
				[die],
				undefined,
			);
			expect(die.results[0].result).toBe(8);
		});

		it('decrements and clamps at 1 (min)', () => {
			const die = makeDie(8, [{ result: 2 }]);
			applyMutationStep(
				{ target: { kind: 'all' }, operation: { type: 'bump', delta: -5 } },
				[die],
				undefined,
			);
			expect(die.results[0].result).toBe(1);
			expect((die.results[0] as MutatedResult).mutation!.rolledValue).toBe(2);
		});
	});

	describe('max operation', () => {
		it('sets result to faces', () => {
			const die = makeDie(12, [{ result: 7 }]);
			applyMutationStep(
				{ target: { kind: 'all' }, operation: { type: 'max' }, source: 'Doomed' },
				[die],
				undefined,
			);
			expect(die.results[0].result).toBe(12);
			expect((die.results[0] as MutatedResult).mutation!.rolledValue).toBe(7);
		});
	});

	describe('min operation', () => {
		it('sets result to 1', () => {
			const die = makeDie(8, [{ result: 5 }]);
			applyMutationStep({ target: { kind: 'all' }, operation: { type: 'min' } }, [die], undefined);
			expect(die.results[0].result).toBe(1);
		});
	});

	describe('floor operation', () => {
		it('raises result below minimum', () => {
			const die = makeDie(12, [{ result: 3 }]);
			applyMutationStep(
				{
					target: { kind: 'all' },
					operation: { type: 'floor', minimum: 6 },
					source: 'BOUNDLESS RAGE',
				},
				[die],
				undefined,
			);
			expect(die.results[0].result).toBe(6);
			expect((die.results[0] as MutatedResult).mutation!.rolledValue).toBe(3);
		});

		it('does not lower result above minimum', () => {
			const die = makeDie(12, [{ result: 9 }]);
			applyMutationStep(
				{
					target: { kind: 'all' },
					operation: { type: 'floor', minimum: 6 },
					source: 'BOUNDLESS RAGE',
				},
				[die],
				undefined,
			);
			expect(die.results[0].result).toBe(9);
			// Still tagged even though value didn't change
			expect((die.results[0] as MutatedResult).mutation!.rolledValue).toBe(9);
		});

		it('clamps floor minimum to faces', () => {
			const die = makeDie(4, [{ result: 2 }]);
			applyMutationStep(
				{ target: { kind: 'all' }, operation: { type: 'floor', minimum: 6 } },
				[die],
				undefined,
			);
			// floor 6 on d4 clamps to faces=4
			expect(die.results[0].result).toBe(4);
		});
	});

	describe('ceiling operation', () => {
		it('lowers result above maximum', () => {
			const die = makeDie(8, [{ result: 7 }]);
			applyMutationStep(
				{ target: { kind: 'all' }, operation: { type: 'ceiling', maximum: 4 } },
				[die],
				undefined,
			);
			expect(die.results[0].result).toBe(4);
			expect((die.results[0] as MutatedResult).mutation!.rolledValue).toBe(7);
		});

		it('does not raise result below maximum', () => {
			const die = makeDie(8, [{ result: 3 }]);
			applyMutationStep(
				{ target: { kind: 'all' }, operation: { type: 'ceiling', maximum: 4 } },
				[die],
				undefined,
			);
			expect(die.results[0].result).toBe(3);
		});
	});

	describe('target: primary', () => {
		it('mutates only primary die results', () => {
			const primary = makeDie(8, [{ result: 3 }]);
			const bonus = makeDie(6, [{ result: 4 }]);
			applyMutationStep(
				{ target: { kind: 'primary' }, operation: { type: 'max' } },
				[primary, bonus],
				primary,
			);
			expect(primary.results[0].result).toBe(8);
			expect(bonus.results[0].result).toBe(4); // untouched
		});

		it('falls back to leftmost c/cv-tagged die when primaryDie is undefined', () => {
			const tagged = makeDie(8, [{ result: 3 }], ['c']);
			(tagged as any)[NIMBLE_MODS] = { canCrit: true, explosionStyle: 'standard' };

			const untagged = makeDie(6, [{ result: 5 }]);
			applyMutationStep(
				{ target: { kind: 'primary' }, operation: { type: 'max' } },
				[tagged, untagged],
				undefined,
			);
			expect(tagged.results[0].result).toBe(8);
			expect(untagged.results[0].result).toBe(5);
		});
	});

	describe('target: all', () => {
		it('mutates all active results across all die terms', () => {
			const d1 = makeDie(8, [{ result: 3 }, { result: 6 }]);
			const d2 = makeDie(6, [{ result: 2 }]);
			applyMutationStep(
				{ target: { kind: 'all' }, operation: { type: 'max' } },
				[d1, d2],
				undefined,
			);
			expect(d1.results[0].result).toBe(8);
			expect(d1.results[1].result).toBe(8);
			expect(d2.results[0].result).toBe(6);
		});

		it('skips discarded results', () => {
			const die = makeDie(8, [
				{ result: 3, active: true },
				{ result: 5, active: false, discarded: true },
			]);
			applyMutationStep({ target: { kind: 'all' }, operation: { type: 'max' } }, [die], undefined);
			expect(die.results[0].result).toBe(8);
			expect(die.results[1].result).toBe(5); // untouched
		});
	});

	describe('target: tagged', () => {
		it('mutates only dice with matching modifier', () => {
			const cDie = makeDie(8, [{ result: 3 }], ['c']);
			const nDie = makeDie(6, [{ result: 4 }], ['n']);
			applyMutationStep(
				{ target: { kind: 'tagged', modifier: 'c' }, operation: { type: 'max' } },
				[cDie, nDie],
				undefined,
			);
			expect(cDie.results[0].result).toBe(8);
			expect(nDie.results[0].result).toBe(4);
		});
	});

	describe('target: index', () => {
		it('mutates only the result at the given flattened index', () => {
			const d1 = makeDie(8, [{ result: 3 }, { result: 6 }]);
			const d2 = makeDie(6, [{ result: 2 }]);
			applyMutationStep(
				{ target: { kind: 'index', index: 1 }, operation: { type: 'min' } },
				[d1, d2],
				undefined,
			);
			expect(d1.results[0].result).toBe(3); // index 0, untouched
			expect(d1.results[1].result).toBe(1); // index 1, mutated
			expect(d2.results[0].result).toBe(2); // index 2, untouched
		});
	});

	describe('mutation metadata flags', () => {
		it('propagates countsAsCrit and triggersExplosion from step', () => {
			const die = makeDie(8, [{ result: 3 }]);
			applyMutationStep(
				{
					target: { kind: 'all' },
					operation: { type: 'set', value: 8 },
					countsAsCrit: true,
					triggersExplosion: true,
					source: 'Vicious Opportunist',
				},
				[die],
				undefined,
			);
			const m = (die.results[0] as MutatedResult).mutation!;
			expect(m.countsAsCrit).toBe(true);
			expect(m.triggersExplosion).toBe(true);
			expect(m.source).toBe('Vicious Opportunist');
		});

		it('defaults countsAsCrit and triggersExplosion to false', () => {
			const die = makeDie(8, [{ result: 5 }]);
			applyMutationStep(
				{ target: { kind: 'all' }, operation: { type: 'bump', delta: 1 } },
				[die],
				undefined,
			);
			const m = (die.results[0] as MutatedResult).mutation!;
			expect(m.countsAsCrit).toBe(false);
			expect(m.triggersExplosion).toBe(false);
			expect(m.source).toBe('unknown');
		});
	});
});
