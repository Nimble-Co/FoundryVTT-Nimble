import { describe, expect, it } from 'vitest';
import { DamageRoll } from '../DamageRoll.js';

type DieTerm = foundry.dice.terms.Die;

/** Evaluates as Foundry does with `maximize`: each die gives its max. */
async function atMax(formula: string, options: Partial<DamageRoll.Options>) {
	const roll = new DamageRoll(formula, {}, {
		canCrit: true,
		canMiss: true,
		rollMode: 0,
		primaryDieValue: 0,
		primaryDieModifier: 0,
		...options,
	} as DamageRoll.Options);
	const base = Object.getPrototypeOf(DamageRoll.prototype);
	const own = Object.getOwnPropertyDescriptor(base, '_evaluate');
	let maximized = false;
	Object.defineProperty(base, '_evaluate', {
		value: async function (this: DamageRoll, evaluation: { maximize?: boolean }) {
			maximized = evaluation?.maximize === true;
			for (const term of this.terms as DieTerm[]) {
				if (!(term instanceof foundry.dice.terms.Die)) continue;
				term.results = Array.from({ length: term.number ?? 1 }, () => ({
					result: term.faces ?? 0,
					active: true,
				}));
			}
			Object.assign(this, { _total: 19 });
			return this;
		},
		configurable: true,
		writable: true,
	});
	try {
		await (roll as unknown as { _evaluate(o?: object): Promise<void> })._evaluate({});
	} finally {
		if (own) Object.defineProperty(base, '_evaluate', own);
		else delete base._evaluate;
	}
	return { roll, maximized };
}

const dice = (roll: DamageRoll) =>
	(roll.terms as DieTerm[])
		.filter((term) => term instanceof foundry.dice.terms.Die)
		.flatMap((term) => term.results.map((result) => result.result));

describe('a roll with max damage', () => {
	it('gives each die its max, with no die extra', async () => {
		const { roll, maximized } = await atMax('2d8+3', { maxDamage: 'hit' });

		expect(maximized).toBe(true);
		expect(dice(roll)).toEqual([8, 8]);
	});

	it('has no explosion and no die for advantage', async () => {
		const { roll } = await atMax('1d6', { maxDamage: 'crit', rollMode: 2 });

		expect(dice(roll)).toEqual([6]);
		expect((roll.terms[0] as DieTerm).modifiers).toEqual([]);
	});

	it('is a hit that does not crit when it gives a hit', async () => {
		const { roll } = await atMax('1d6', { maxDamage: 'hit' });

		expect(roll.isCritical).toBe(false);
		expect(roll.isMiss).toBe(false);
	});

	it('is a crit with no crit dice when it gives a crit', async () => {
		const { roll } = await atMax('1d6', { maxDamage: 'crit' });

		expect(roll.isCritical).toBe(true);
		expect(roll.isMiss).toBe(false);
		expect(dice(roll)).toEqual([6]);
	});

	it('still misses when a target makes it miss', async () => {
		const { roll } = await atMax('1d6', { maxDamage: 'crit', forceMiss: true });

		expect(roll.isMiss).toBe(true);
		expect(roll.isCritical).toBe(false);
	});

	it('takes off the crit dice modifiers of a formula that has them', async () => {
		const { roll } = await atMax('2d6c', { maxDamage: 'hit' });

		expect(roll.modifierMode).toBe(false);
		expect(dice(roll)).toEqual([6, 6]);
	});

	it('says that no die was rolled', async () => {
		const { roll } = await atMax('1d6', { maxDamage: 'hit' });

		expect(roll.noDice).toBe(true);
	});

	it('cannot be made a crit', async () => {
		const { roll } = await atMax('1d6', { maxDamage: 'hit' });

		await expect(roll.makeCritical()).resolves.toBeNull();
	});
});
