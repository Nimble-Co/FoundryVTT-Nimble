import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DamageRoll } from '../../dice/DamageRoll.js';
import { PrimaryDie } from '../../dice/terms/PrimaryDie.js';
import { stageAndRoll } from './stageAndRoll.js';

/**
 * Install a base Roll.prototype._evaluate that walks die terms, calls
 * CONFIG.Dice.randomUniform() once per die, and stores the mapped face value
 * as a result entry. This bridges stageAndRoll's randomUniform monkey-patch
 * into the test mock (which otherwise never invokes randomUniform).
 *
 * For the PRIMARY die specifically, we additionally:
 *  - mark the result with `exploded: true` if it rolled max (mimics the 'x'
 *    modifier so DamageRoll._finalizeOutcome reports isCritical correctly)
 *  - leave a result of 1 alone (PrimaryDie.isMiss is a getter that checks
 *    `result === 1`)
 */
let savedEvaluate: PropertyDescriptor | undefined;

function stubBaseRollEvaluate() {
	const BaseRoll = Object.getPrototypeOf(DamageRoll.prototype);
	// The production mock Roll's evaluate() does not delegate to _evaluate.
	// Patch it so DamageRoll._evaluate (which is the override under test) runs.
	savedEvaluate = Object.getOwnPropertyDescriptor(BaseRoll, 'evaluate');
	Object.defineProperty(BaseRoll, 'evaluate', {
		value: async function (options?: unknown) {
			if (typeof (this as any)._evaluate === 'function') {
				return await (this as any)._evaluate(options);
			}
			(this as any)._evaluated = true;
			(this as any)._total ??= 0;
			return this;
		},
		configurable: true,
		writable: true,
	});
	Object.defineProperty(BaseRoll, '_evaluate', {
		value: async function () {
			const terms = (this as any).terms ?? [];
			let total = 0;
			for (const term of terms) {
				if (term && typeof term.faces === 'number' && Array.isArray(term.results)) {
					const number: number = term.number ?? 1;
					const faces: number = term.faces;
					// Only generate results if not already pre-staged via primaryDieValue.
					if (term.results.length === 0) {
						for (let i = 0; i < number; i++) {
							const rv = (CONFIG as any).Dice.randomUniform();
							const value = Math.ceil(rv * faces);
							const result: any = { result: value, active: true };
							if (term instanceof PrimaryDie && value === faces) {
								result.exploded = true;
							}
							term.results.push(result);
						}
					}
					term._evaluated = true;
					for (const r of term.results) {
						if (r.active && !r.discarded) total += r.result;
					}
				} else if (term && typeof term.number === 'number' && term.operator === undefined) {
					// NumericTerm
					total += term.number;
				}
			}
			(this as any)._evaluated = true;
			(this as any)._total = total;
			return this;
		},
		configurable: true,
		writable: true,
	});
}

function uninstallBaseRollEvaluate() {
	const BaseRoll = Object.getPrototypeOf(DamageRoll.prototype);
	delete (BaseRoll as any)._evaluate;
	if (savedEvaluate) {
		Object.defineProperty(BaseRoll, 'evaluate', savedEvaluate);
	} else {
		delete (BaseRoll as any).evaluate;
	}
	savedEvaluate = undefined;
}

describe('stageAndRoll', () => {
	beforeEach(() => {
		stubBaseRollEvaluate();
		// Ensure CONFIG.Dice.randomUniform exists and is a deterministic baseline
		// that returns 0.5 (so a d6 produces 3, etc.) — tests that care about the
		// fallback value override this.
		(CONFIG as any).Dice.randomUniform = () => 0.5;
	});

	afterEach(() => {
		uninstallBaseRollEvaluate();
		delete (CONFIG as any).Dice.randomUniform;
	});

	it('empty staged queue uses original randomUniform', async () => {
		const original = vi.fn(() => 0.5);
		(CONFIG as any).Dice.randomUniform = original;

		const { roll, trace } = await stageAndRoll(
			'1d6',
			{ canCrit: false, canMiss: false, rollMode: 0, primaryDieValue: 0, primaryDieModifier: 0 },
			[],
		);

		expect(original).toHaveBeenCalled();
		// Math.ceil(0.5 * 6) === 3
		const dieTerm = (roll as any).terms.find(
			(t: any) => typeof t.faces === 'number' && Array.isArray(t.results),
		);
		expect(dieTerm.results[0].result).toBe(3);
		expect(trace.stagedValuesRemaining).toBe(0);
	});

	it('single staged value produces exact die result', async () => {
		const { roll } = await stageAndRoll(
			'1d6',
			{ canCrit: false, canMiss: false, rollMode: 0, primaryDieValue: 0, primaryDieModifier: 0 },
			[{ value: 4, faces: 6 }],
		);
		const dieTerm = (roll as any).terms.find(
			(t: any) => typeof t.faces === 'number' && Array.isArray(t.results),
		);
		expect(dieTerm.results[0].result).toBe(4);
	});

	it('multiple staged values consumed in order', async () => {
		// 2d6 with canCrit/canMiss false → no PrimaryDie extraction; the term
		// stays a SharedMockDie with number=2.
		const { roll } = await stageAndRoll(
			'2d6',
			{ canCrit: false, canMiss: false, rollMode: 0, primaryDieValue: 0, primaryDieModifier: 0 },
			[
				{ value: 1, faces: 6 },
				{ value: 6, faces: 6 },
			],
		);
		const dieTerm = (roll as any).terms.find(
			(t: any) => typeof t.faces === 'number' && Array.isArray(t.results),
		);
		expect(dieTerm.results[0].result).toBe(1);
		expect(dieTerm.results[1].result).toBe(6);
	});

	it('queue exhaustion falls back to original randomUniform', async () => {
		const fallback = vi.fn(() => 0.5);
		(CONFIG as any).Dice.randomUniform = fallback;

		const { roll, trace } = await stageAndRoll(
			'3d6',
			{ canCrit: false, canMiss: false, rollMode: 0, primaryDieValue: 0, primaryDieModifier: 0 },
			[{ value: 3, faces: 6 }],
		);

		const dieTerm = (roll as any).terms.find(
			(t: any) => typeof t.faces === 'number' && Array.isArray(t.results),
		);
		expect(dieTerm.results[0].result).toBe(3);
		expect(dieTerm.results[1].result).toBe(3); // 0.5 * 6 ceil = 3
		expect(dieTerm.results[2].result).toBe(3);
		expect(fallback).toHaveBeenCalledTimes(2);
		expect(trace.stagedValuesRemaining).toBe(0);
	});

	it('throw during evaluate still restores randomUniform', async () => {
		const original = vi.fn(() => 0.5);
		(CONFIG as any).Dice.randomUniform = original;

		// Force _evaluate to throw.
		const BaseRoll = Object.getPrototypeOf(DamageRoll.prototype);
		const prior = (BaseRoll as any)._evaluate;
		(BaseRoll as any)._evaluate = async () => {
			throw new Error('boom');
		};

		try {
			await expect(
				stageAndRoll(
					'1d6',
					{
						canCrit: false,
						canMiss: false,
						rollMode: 0,
						primaryDieValue: 0,
						primaryDieModifier: 0,
					},
					[{ value: 4, faces: 6 }],
				),
			).rejects.toThrow('boom');

			expect((CONFIG as any).Dice.randomUniform).toBe(original);
		} finally {
			(BaseRoll as any)._evaluate = prior;
		}
	});

	it('stagedValuesRemaining is zero on exact consumption', async () => {
		const { trace } = await stageAndRoll(
			'1d6',
			{ canCrit: false, canMiss: false, rollMode: 0, primaryDieValue: 0, primaryDieModifier: 0 },
			[{ value: 2, faces: 6 }],
		);
		expect(trace.stagedValuesRemaining).toBe(0);
	});

	it('stagedValuesRemaining is non-zero when queue outlasts the roll', async () => {
		const { trace } = await stageAndRoll(
			'1d6',
			{ canCrit: false, canMiss: false, rollMode: 0, primaryDieValue: 0, primaryDieModifier: 0 },
			[
				{ value: 2, faces: 6 },
				{ value: 5, faces: 6 },
				{ value: 6, faces: 6 },
			],
		);
		expect(trace.stagedValuesRemaining).toBe(2);
	});

	it('force crit scenario', async () => {
		const { roll, trace } = await stageAndRoll(
			'1d6',
			{ canCrit: true, canMiss: true, rollMode: 0, primaryDieValue: 0, primaryDieModifier: 0 },
			[{ value: 6, faces: 6 }],
		);
		expect(roll.primaryDie?.results[0]?.result).toBe(6);
		expect(trace.isCritical).toBe(true);
	});

	it('force miss scenario', async () => {
		const { roll, trace } = await stageAndRoll(
			'1d6',
			{ canCrit: true, canMiss: true, rollMode: 0, primaryDieValue: 0, primaryDieModifier: 0 },
			[{ value: 1, faces: 6 }],
		);
		expect(roll.primaryDie?.results[0]?.result).toBe(1);
		expect(trace.isMiss).toBe(true);
		expect(trace.isCritical).toBe(false);
	});

	it('force crit with vicious', async () => {
		// Vicious explosion path constructs `new Roll("2dN")` and calls .evaluate()
		// inside DamageRoll._evaluateViciousExplosion. The mock Roll's evaluate()
		// is a no-op that doesn't run our stubbed _evaluate, so explosion dice
		// won't be appended; we just verify the crit branch fired.
		const { roll, trace } = await stageAndRoll(
			'1d6',
			{
				canCrit: true,
				canMiss: true,
				rollMode: 0,
				primaryDieValue: 0,
				primaryDieModifier: 0,
				isVicious: true,
			},
			[{ value: 6, faces: 6 }],
		);
		expect(roll.primaryDie?.results[0]?.result).toBe(6);
		expect(trace.isCritical).toBe(true);
	});
});
