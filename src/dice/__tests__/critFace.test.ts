import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DamageRoll } from '../DamageRoll.js';
import { NIMBLE_MODS } from '../nimbleDieModifiers.js';

type Result = { result: number; active: boolean; discarded?: boolean; exploded?: boolean };

/** A roll whose dice show `dice` (one list per die term), read again from those faces. */
function readAgain(formula: string, dice: Result[][], options: Partial<DamageRoll.Options> = {}) {
	const roll = new DamageRoll(formula, {}, {
		canCrit: true,
		canMiss: true,
		rollMode: 0,
		primaryDieValue: 0,
		primaryDieModifier: 0,
		...options,
	} as DamageRoll.Options);
	const terms = roll.terms.filter((term) => term instanceof foundry.dice.terms.Die);
	terms.forEach((term, index) => {
		term.results = dice[index] ?? [];
		Object.assign(term, { _evaluated: true });
	});
	Object.assign(roll, { _evaluated: true, _evaluateASTSync: () => 0 });
	roll.refreshOutcome();
	return roll;
}

const kept = (result: number): Result => ({ result, active: true });
const dropped = (result: number): Result => ({ result, active: false, discarded: true });

describe('the crit face of a Primary Die', () => {
	beforeEach(() => {
		(CONFIG.Dice as unknown as { parser: unknown }).parser = { toAST: () => null };
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		delete (CONFIG.Dice as unknown as { parser?: unknown }).parser;
	});

	it('is 1 for a Forced Crit on a hit on a roll that cannot miss', () => {
		const roll = readAgain('1d6', [[kept(1)]], { forcedCrit: 'onHit', canMiss: false });
		expect(roll.isCritical).toBe(true);
		expect(roll.isMiss).toBe(false);
	});

	it('finds the crit die of a roll rebuilt from stored data', () => {
		const roll = new DamageRoll('1d8c', {}, {
			canCrit: true,
			canMiss: true,
			rollMode: 0,
			primaryDieValue: 0,
			primaryDieModifier: 0,
			forcedCrit: 'always',
		} as DamageRoll.Options);
		const term = roll.terms.find((candidate) => candidate instanceof foundry.dice.terms.Die);
		delete (term as unknown as Record<symbol, unknown>)[NIMBLE_MODS];
		Object.assign(term as object, { modifiers: ['c'] });
		expect(roll.critFaceOf(term)).toBe(1);
	});

	it('is the max when no crit threshold is set', () => {
		expect(readAgain('1d6', [[kept(5)]]).isCritical).toBe(false);
		expect(readAgain('1d6', [[kept(6)]]).isCritical).toBe(true);
	});

	it('crits on the threshold face, and that face is not a miss', () => {
		const roll = readAgain('1d6', [[kept(2)]], { criticalThreshold: 2, missThreshold: 2 });

		expect(roll.isCritical).toBe(true);
		expect(roll.isMiss).toBe(false);
	});

	it('crits on the threshold face when the formula has more dice', () => {
		const roll = readAgain('2d6', [[kept(5)], [kept(6)]], { criticalThreshold: 5 });

		expect(roll.isCritical).toBe(true);
		expect(readAgain('2d6', [[kept(4)], [kept(6)]], { criticalThreshold: 5 }).isCritical).toBe(
			false,
		);
	});

	it('reads only the kept die', () => {
		const advantage = { rollMode: 1, criticalThreshold: 5 };

		expect(readAgain('1d6', [[dropped(6), kept(5)]], advantage).isCritical).toBe(true);
		expect(readAgain('1d6', [[dropped(5), kept(3)]], advantage).isCritical).toBe(false);
	});

	it('keeps the threshold when the roll is rebuilt from its options', () => {
		const first = readAgain('1d6', [[kept(4)]], { criticalThreshold: 5 });
		const rebuilt = readAgain('1d6', [[kept(5)]], first.options);

		expect(rebuilt.isCritical).toBe(true);
	});

	it('in modifier mode, crits on the threshold with the first crit die only', () => {
		const roll = readAgain('2d6c', [[kept(5), kept(5)]], { criticalThreshold: 5 });

		expect(roll.isCritical).toBe(true);
		expect(roll.critCount).toBe(1);
	});

	it('in modifier mode, the threshold face is not a miss', () => {
		const roll = readAgain('1d6c', [[kept(2)]], { criticalThreshold: 2, missThreshold: 2 });

		expect(roll.isMiss).toBe(false);
	});

	it('starts a vicious explosion on the threshold face, and chains only on the max', async () => {
		const explosion = new foundry.dice.terms.Die({ number: 2, faces: 6 });
		explosion.results = [kept(5), kept(2)];
		vi.stubGlobal(
			'Roll',
			class {
				terms = [explosion];
				async evaluate() {
					return this;
				}
			},
		);
		const roll = new DamageRoll('1d6', {}, {
			canCrit: true,
			canMiss: true,
			rollMode: 0,
			primaryDieValue: 0,
			primaryDieModifier: 0,
			explosionStyle: 'vicious',
			criticalThreshold: 5,
		} as DamageRoll.Options);
		const die = roll.primaryDie as foundry.dice.terms.Die;
		die.results = [kept(5)];
		Object.assign(die, { _evaluated: true });
		const base = Object.getPrototypeOf(DamageRoll.prototype);
		const own = Object.getOwnPropertyDescriptor(base, '_evaluate');
		Object.defineProperty(base, '_evaluate', {
			value: async function (this: unknown) {
				return this;
			},
			configurable: true,
			writable: true,
		});

		try {
			await (roll as unknown as { _evaluate(): Promise<void> })._evaluate();
		} finally {
			if (own) Object.defineProperty(base, '_evaluate', own);
			else delete base._evaluate;
		}

		expect(roll.isCritical).toBe(true);
		expect(die.results.map((r) => r.result)).toEqual([5, 5, 2]);
	});
});
