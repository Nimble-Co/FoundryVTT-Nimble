import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DamageRoll } from '../DamageRoll.js';
import { changeOneDie, makeRollCrit, rerollOneDie } from '../oneDieReroll.js';

type Result = { result: number; active: boolean; exploded?: boolean; provenance?: string };

const kept = (result: number, extra: Partial<Result> = {}): Result => ({
	result,
	active: true,
	...extra,
});

/** Foundry's `Roll` for the dice a crit rolls: each one gives the next list of `rolls`. */
function crittingDice(...rolls: Result[][]) {
	const queue = [...rolls];
	vi.stubGlobal(
		'Roll',
		class {
			terms: foundry.dice.terms.Die[];
			constructor(formula: string) {
				const [, count, faces] = /^(\d+)d(\d+)/.exec(formula) ?? [];
				const die = new foundry.dice.terms.Die({ number: Number(count), faces: Number(faces) });
				die.results = queue.shift() ?? [];
				this.terms = [die];
			}
			async evaluate() {
				return this;
			}
		},
	);
}

/** An attack whose kept Primary Die rolled `face`, evaluated with `options`. */
async function attack(
	face: number,
	options: Partial<DamageRoll.Options> = {},
	formula = '1d6',
	otherDice: Result[][] = [],
) {
	const roll = new DamageRoll(formula, {}, {
		canCrit: true,
		canMiss: true,
		rollMode: 0,
		primaryDieValue: 0,
		primaryDieModifier: 0,
		...options,
	} as DamageRoll.Options);
	const die = roll.primaryDie as foundry.dice.terms.Die;
	die.results = [kept(face)];
	Object.assign(die, { _evaluated: true });
	const others = roll.terms.filter((t) => t instanceof foundry.dice.terms.Die && t !== die);
	others.forEach((term, index) => {
		(term as foundry.dice.terms.Die).results = otherDice[index] ?? [];
	});
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
	return roll;
}

const faces = (roll: DamageRoll) => roll.primaryDie?.results.map((r) => r.result);

const draws = (...values: number[]) => {
	const queue = [...values];
	return async () => queue.shift() ?? 1;
};

const PRIMARY = { term: 0, result: 0 };

describe('a Forced Crit', () => {
	beforeEach(() => {
		(CONFIG.Dice as unknown as { parser: unknown }).parser = { toAST: () => null };
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
		delete (CONFIG.Dice as unknown as { parser?: unknown }).parser;
	});

	it('that always applies crits a 1, which then is not a miss, and rolls the Primary Die again', async () => {
		crittingDice([kept(4)]);
		const roll = await attack(1, { forcedCrit: 'always' });

		expect(roll.isCritical).toBe(true);
		expect(roll.isMiss).toBe(false);
		expect(faces(roll)).toEqual([1, 4]);
	});

	it('on a hit leaves a miss a miss, with no extra die', async () => {
		crittingDice([kept(4)]);
		const roll = await attack(1, { forcedCrit: 'onHit' });

		expect(roll.isCritical).toBe(false);
		expect(roll.isMiss).toBe(true);
		expect(faces(roll)).toEqual([1]);
	});

	it('on a hit crits a hit', async () => {
		crittingDice([kept(3)]);
		const roll = await attack(2, { forcedCrit: 'onHit' });

		expect(roll.isCritical).toBe(true);
		expect(faces(roll)).toEqual([2, 3]);
	});

	it('rolls crit dice that go on only on the max', async () => {
		crittingDice([kept(6, { exploded: true }), kept(5)]);
		const roll = await attack(3, { forcedCrit: 'always' });

		expect(faces(roll)).toEqual([3, 6, 5]);
	});

	it('also rolls the Primary Die again for a crit on the crit threshold', async () => {
		crittingDice([kept(2)]);
		const roll = await attack(5, { criticalThreshold: 5 });

		expect(roll.isCritical).toBe(true);
		expect(faces(roll)).toEqual([5, 2]);
	});

	it('adds the vicious extra die as normal', async () => {
		crittingDice([kept(2), kept(4)]);
		const roll = await attack(3, { forcedCrit: 'always', explosionStyle: 'vicious' });

		expect(roll.isCritical).toBe(true);
		expect(faces(roll)).toEqual([3, 2, 4]);
	});

	it('takes a number after a minus away from the total with the crit dice', async () => {
		crittingDice([kept(4)]);
		const roll = await attack(3, { forcedCrit: 'always' }, '1d6 - 1');

		expect(roll.total).toBe(6);
	});

	it('takes a number after a minus away from a vicious crit total', async () => {
		crittingDice([kept(3), kept(2)]);
		const roll = await attack(6, { explosionStyle: 'vicious' }, '1d6 - 1');

		expect(roll.total).toBe(10);
	});

	it('crits on the crit range below the max, and rolls the Primary Die again', async () => {
		crittingDice([kept(3)]);
		const roll = await attack(5, { critRange: 1 });

		expect(roll.isCritical).toBe(true);
		expect(faces(roll)).toEqual([5, 3]);
	});

	it('does not crit below the crit range', async () => {
		crittingDice([kept(3)]);
		const roll = await attack(4, { critRange: 1 });

		expect(roll.isCritical).toBe(false);
		expect(faces(roll)).toEqual([4]);
	});

	it('crits on a hit when another die of the roll is at its max', async () => {
		crittingDice([kept(2)]);
		const roll = await attack(3, { anyDieCrits: true }, '2d6', [[kept(6)]]);

		expect(roll.isCritical).toBe(true);
		expect(faces(roll)).toEqual([3, 2]);
	});

	it('leaves a miss a miss when another die is at its max', async () => {
		crittingDice([kept(2)]);
		const roll = await attack(1, { anyDieCrits: true }, '2d6', [[kept(6)]]);

		expect(roll.isCritical).toBe(false);
		expect(roll.isMiss).toBe(true);
	});

	it('does not crit when no die is at its max', async () => {
		crittingDice([kept(2)]);
		const roll = await attack(3, { anyDieCrits: true }, '2d6', [[kept(5)]]);

		expect(roll.isCritical).toBe(false);
	});

	it('does nothing on a roll that cannot crit', async () => {
		crittingDice([kept(4)]);
		const roll = await attack(3, {
			forcedCrit: 'always',
			canCrit: false,
			canMiss: false,
			multiTarget: true,
		});

		expect(roll.isCritical).toBe(false);
		expect(faces(roll)).toEqual([3]);
	});

	describe('after a reroll or a change', () => {
		function inPlace(roll: DamageRoll) {
			Object.assign(roll, { _evaluateASTSync: () => 0 });
			vi.spyOn(foundry.dice.Roll, 'fromData').mockImplementation(((data: { class?: string }) =>
				data.class === 'Roll' ? data : roll) as never);
		}

		it('that always applies stays: the new face crits and rolls again', async () => {
			crittingDice([kept(4)]);
			const roll = await attack(3, { forcedCrit: 'always' });
			inPlace(roll);

			const { roll: next } = await rerollOneDie(roll, PRIMARY, { draw: draws(1, 2) });

			expect(next.isCritical).toBe(true);
			expect(next.isMiss).toBe(false);
			expect(faces(next)).toEqual([1, 2]);
		});

		it('on a hit is worked out again: a new 1 is a miss with no crit dice', async () => {
			crittingDice([kept(4)]);
			const roll = await attack(3, { forcedCrit: 'onHit' });
			inPlace(roll);

			const { roll: next } = await changeOneDie(roll, PRIMARY, { mode: 'set', value: 1 });

			expect(next.isCritical).toBe(false);
			expect(next.isMiss).toBe(true);
			expect(faces(next)).toEqual([1]);
		});

		it('on the crit threshold rolls again for a new face on the threshold, and goes on only on the max', async () => {
			crittingDice([kept(1)]);
			const roll = await attack(2, { criticalThreshold: 5 });
			inPlace(roll);

			const { roll: next } = await rerollOneDie(roll, PRIMARY, { draw: draws(5, 5) });

			expect(next.isCritical).toBe(true);
			expect(faces(next)).toEqual([5, 5]);
		});
	});

	describe('made by a Make It a Crit use after the roll', () => {
		function inPlace(roll: DamageRoll) {
			Object.assign(roll, { _evaluateASTSync: () => 0 });
			vi.spyOn(foundry.dice.Roll, 'fromData').mockImplementation(((data: { class?: string }) =>
				data.class === 'Roll' ? data : roll) as never);
		}

		it('keeps the face, rolls the crit dice, and throws only those', async () => {
			crittingDice([kept(4)]);
			const roll = await attack(3);
			inPlace(roll);

			const made = await makeRollCrit(roll);

			expect(made.roll.isCritical).toBe(true);
			expect(faces(made.roll)).toEqual([3, 4]);
			expect(made.next).toBe(3);
			expect(made.faces).toBe(6);
			expect(
				(made.thrown?.terms[0] as foundry.dice.terms.Die | undefined)?.results.map((r) => r.result),
			).toEqual([4]);
		});

		it('makes a miss a crit', async () => {
			crittingDice([kept(5)]);
			const roll = await attack(1);
			inPlace(roll);

			const { roll: next } = await makeRollCrit(roll);

			expect(next.isCritical).toBe(true);
			expect(next.isMiss).toBe(false);
		});

		it('stays a crit after a reroll of the Primary Die', async () => {
			crittingDice([kept(4)]);
			const roll = await attack(3);
			inPlace(roll);
			const { roll: crit } = await makeRollCrit(roll);

			const { roll: next } = await rerollOneDie(crit, PRIMARY, { draw: draws(1, 2) });

			expect(next.isCritical).toBe(true);
			expect(next.isMiss).toBe(false);
		});

		it('adds the vicious extra die', async () => {
			crittingDice([kept(2), kept(4)]);
			const roll = await attack(3, { explosionStyle: 'vicious' });
			inPlace(roll);

			const { roll: next } = await makeRollCrit(roll);

			expect(faces(next)).toEqual([3, 2, 4]);
		});

		it('does not name a Forced Crit that did not give this crit', async () => {
			crittingDice([kept(4)]);
			const roll = await attack(1, {
				forcedCrit: 'onHit',
				outcomeSources: { forcedCrit: ['Target Stunned'], cannotMiss: ['Other'] },
			});
			inPlace(roll);

			const { roll: next } = await makeRollCrit(roll);

			expect(next.options.outcomeSources).toEqual({ cannotMiss: ['Other'] });
		});

		it('fails on a roll that cannot crit, and on a crit', async () => {
			crittingDice([kept(4)]);
			const multi = await attack(3, { canCrit: false, canMiss: false, multiTarget: true });
			inPlace(multi);
			await expect(makeRollCrit(multi)).rejects.toThrow('cannot be made a crit');

			vi.restoreAllMocks();
			crittingDice([kept(2)]);
			const crit = await attack(6);
			inPlace(crit);
			await expect(makeRollCrit(crit)).rejects.toThrow('cannot be made a crit');
		});
	});
});
