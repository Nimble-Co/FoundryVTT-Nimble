import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DamageRoll } from '../DamageRoll.js';
import { changeOneDie, pickableDice, rerollOneDie } from '../oneDieReroll.js';

type Result = {
	result: number;
	active: boolean;
	exploded?: boolean;
	faces?: number;
	provenance?: string;
};

const die = (result: number, extra: Partial<Result> = {}): Result => ({
	result,
	active: true,
	...extra,
});

/** Foundry's `Roll` for dice rolled during the crit: each one gives the next list. */
function diceToRoll(...rolls: Result[][]) {
	const queue = [...rolls];
	const formulas: string[] = [];
	vi.stubGlobal(
		'Roll',
		class {
			terms: foundry.dice.terms.Die[];
			constructor(formula: string) {
				formulas.push(formula);
				const [, count, faces] = /^(\d+)d(\d+)/.exec(formula) ?? [];
				const term = new foundry.dice.terms.Die({ number: Number(count), faces: Number(faces) });
				term.results = queue.shift() ?? [];
				this.terms = [term];
			}
			async evaluate() {
				return this;
			}
		},
	);
	return formulas;
}

/** An attack whose Primary Die results are `results`, evaluated with `options`. */
async function attack(results: Result[], options: Partial<DamageRoll.Options> = {}) {
	const roll = new DamageRoll('1d6', {}, {
		canCrit: true,
		canMiss: true,
		rollMode: 0,
		primaryDieValue: 0,
		primaryDieModifier: 0,
		...options,
	} as DamageRoll.Options);
	const term = roll.primaryDie as foundry.dice.terms.Die;
	term.results = results;
	Object.assign(term, { _evaluated: true });
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

const values = (roll: DamageRoll) => roll.primaryDie?.results.map((r) => r.result);

describe('a crit with the d20 crit die', () => {
	beforeEach(() => {
		(CONFIG.Dice as unknown as { parser: unknown }).parser = { toAST: () => null };
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		delete (CONFIG.Dice as unknown as { parser?: unknown }).parser;
	});

	it('rolls a d20 in place of the first crit die', async () => {
		const rolled = diceToRoll([die(13)]);

		const roll = await attack([die(6, { exploded: true }), die(2)], { critD20: true });

		expect(rolled).toEqual(['1d20']);
		expect(values(roll)).toEqual([6, 13]);
		expect((roll.primaryDie?.results[1] as Result).faces).toBe(20);
	});

	it('drops the crit dice the old die exploded into', async () => {
		diceToRoll([die(13)]);

		const roll = await attack([die(6, { exploded: true }), die(6, { exploded: true }), die(4)], {
			critD20: true,
		});

		expect(values(roll)).toEqual([6, 13]);
	});

	it('goes on with the die of the weapon when the d20 rolls a 20', async () => {
		const rolled = diceToRoll([die(20)], [die(6, { exploded: true }), die(1)]);

		const roll = await attack([die(6, { exploded: true }), die(2)], { critD20: true });

		expect(rolled).toEqual(['1d20', '1d6x']);
		expect(values(roll)).toEqual([6, 20, 6, 1]);
		expect(roll.primaryDie?.results[1].exploded).toBe(true);
		expect((roll.primaryDie?.results[2] as Result).faces).toBeUndefined();
	});

	it('rolls only one d20 for one crit', async () => {
		const rolled = diceToRoll([die(20)], [die(6, { exploded: true }), die(6)]);

		await attack([die(6, { exploded: true }), die(2)], { critD20: true });

		expect(rolled.filter((formula) => formula === '1d20')).toHaveLength(1);
	});

	it('on a Vicious crit, takes the place of the die that can go on', async () => {
		const rolled = diceToRoll([die(3), die(5)], [die(11)]);

		const roll = await attack([die(6)], { critD20: true, explosionStyle: 'vicious' });

		expect(rolled).toEqual(['2d6', '1d20']);
		expect(values(roll)).toEqual([6, 11, 5]);
	});

	it('does nothing on a roll that is not a crit', async () => {
		const rolled = diceToRoll();

		const roll = await attack([die(3)], { critD20: true });

		expect(rolled).toEqual([]);
		expect(values(roll)).toEqual([3]);
	});

	it('shows the d20 as a die of 20 faces to a picker', async () => {
		diceToRoll([die(13)]);

		const roll = await attack([die(6, { exploded: true }), die(2)], { critD20: true });

		expect(pickableDice(roll as never)[1]).toMatchObject({ faces: 20, value: 13 });
	});
});

describe('a Vicious crit from a rule on the target', () => {
	beforeEach(() => {
		(CONFIG.Dice as unknown as { parser: unknown }).parser = { toAST: () => null };
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		delete (CONFIG.Dice as unknown as { parser?: unknown }).parser;
	});

	it('rolls the Vicious die on each crit die of a standard crit', async () => {
		const roll = await attack([die(6, { exploded: true }), die(6, { exploded: true }), die(2)]);
		diceToRoll([die(4), die(1)]);

		const made = await roll.makeVicious();

		expect(made?.drawn).toEqual([4, 1]);
		expect(values(roll)).toEqual([6, 6, 4, 2, 1]);
		expect(roll.options.explosionStyle).toBe('vicious');
		expect(roll.primaryDie?.modifiers).not.toContain('x');
	});

	it('leaves a roll that is not a crit', async () => {
		const roll = await attack([die(3)]);

		await expect(roll.makeVicious()).resolves.toBeNull();
	});

	it('leaves a roll that is Vicious', async () => {
		diceToRoll([die(3), die(5)]);
		const roll = await attack([die(6)], { explosionStyle: 'vicious' });

		await expect(roll.makeVicious()).resolves.toBeNull();
	});
});

describe('a crit that comes from a change of the roll', () => {
	beforeEach(() => {
		(CONFIG.Dice as unknown as { parser: unknown }).parser = { toAST: () => null };
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
		delete (CONFIG.Dice as unknown as { parser?: unknown }).parser;
	});

	/** The change works on the roll itself, not on a copy. */
	function inPlace(roll: DamageRoll) {
		Object.assign(roll, { _evaluated: true, _evaluateASTSync: () => 0 });
		vi.spyOn(foundry.dice.Roll, 'fromData').mockImplementation((() => roll) as never);
		return roll;
	}

	it('rolls the d20 when a die change gives the crit', async () => {
		const start = inPlace(await attack([die(3)], { critD20: true }));
		diceToRoll([die(17)]);

		await changeOneDie(
			start as never,
			{ term: 0, result: 0 },
			{ mode: 'set', value: 6 },
			{ draw: async () => 2 },
		);

		expect(values(start)).toEqual([6, 17]);
	});

	it('rerolls the d20 as a die of 20 faces', async () => {
		diceToRoll([die(13)]);
		const start = inPlace(await attack([die(6, { exploded: true }), die(2)], { critD20: true }));
		const draw = vi.fn(async (faces: number) => faces - 1);

		const rerolled = await rerollOneDie(start as never, { term: 0, result: 1 }, { draw });

		expect(draw).toHaveBeenCalledWith(20);
		expect(rerolled.next).toBe(19);
	});
});

describe('crit dice on a roll in modifier mode', () => {
	function modifierRoll(options: Partial<DamageRoll.Options> = {}) {
		const roll = new DamageRoll('1d6c', {}, {
			canCrit: true,
			canMiss: false,
			rollMode: 0,
			primaryDieValue: 0,
			primaryDieModifier: 0,
			...options,
		} as DamageRoll.Options);
		const term = roll.terms.find((t) => t instanceof foundry.dice.terms.Die) as Die;
		term.results = [die(6, { exploded: true }), die(2)] as never;
		roll.isCritical = true;
		return { roll, term };
	}
	type Die = foundry.dice.terms.Die;

	beforeEach(() => {
		(CONFIG.Dice as unknown as { parser: unknown }).parser = { toAST: () => null };
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		delete (CONFIG.Dice as unknown as { parser?: unknown }).parser;
	});

	it('uses a d20 for the first crit die', async () => {
		const rolled = diceToRoll([die(13)]);
		const { roll, term } = modifierRoll();
		expect(roll.modifierMode).toBe(true);

		const made = await roll.replaceCritDieWithD20();

		expect(rolled).toEqual(['1d20']);
		expect(made?.drawn).toEqual([13]);
		expect(term.results.map((result) => result.result)).toEqual([6, 13]);
		expect((term.results[1] as Result).faces).toBe(20);
	});

	it('rolls Sneak Attack dice on a crit', async () => {
		diceToRoll([die(5)]);
		const { roll } = modifierRoll();

		const drawn = await roll.addCritDice({
			key: 'k',
			label: 'Sneak Attack',
			role: 'critBonus',
			formula: '1d8',
		});

		expect(drawn).toEqual([5]);
		expect(roll.critDiceLines().map((line) => line.total)).toEqual([5]);
	});
});

describe('Sneak Attack dice', () => {
	const sneak = (formula = '2d8') => ({
		key: 'Actor.h.Item.s:r',
		label: 'Sneak Attack',
		role: 'critBonus',
		formula,
	});
	const lines = (roll: DamageRoll) =>
		roll
			.critDiceLines()
			.map((line) => `${line.label}:${line.role}:${line.values.join('+')}=${line.total}`);

	beforeEach(() => {
		(CONFIG.Dice as unknown as { parser: unknown }).parser = { toAST: () => null };
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
		delete (CONFIG.Dice as unknown as { parser?: unknown }).parser;
	});

	it('roll on a crit, as a line of their own', async () => {
		const rolled = diceToRoll([die(3), die(7)]);

		const roll = await attack([die(6, { exploded: true }), die(2)], { critDice: [sneak()] });

		expect(rolled).toEqual(['2d8']);
		expect(lines(roll)).toEqual(['Sneak Attack:critBonus:3+7=10']);
	});

	it('do not roll on a hit', async () => {
		const rolled = diceToRoll();

		const roll = await attack([die(3)], { critDice: [sneak()] });

		expect(rolled).toEqual([]);
		expect(lines(roll)).toEqual([]);
	});

	it('do not explode', async () => {
		const rolled = diceToRoll([die(8), die(8)]);

		const roll = await attack([die(6, { exploded: true }), die(2)], { critDice: [sneak()] });

		expect(rolled).toEqual(['2d8']);
		expect(lines(roll)).toEqual(['Sneak Attack:critBonus:8+8=16']);
	});

	it('are not Vicious on a Vicious crit', async () => {
		const rolled = diceToRoll([die(2), die(3)], [die(7), die(4)]);

		const roll = await attack([die(6)], { critDice: [sneak()], explosionStyle: 'vicious' });

		expect(rolled).toEqual(['2d6', '2d8']);
		expect(lines(roll)).toEqual(['Sneak Attack:critBonus:7+4=11']);
	});

	it('go away when a change takes the crit away', async () => {
		diceToRoll([die(3), die(7)]);
		const roll = await attack([die(6, { exploded: true }), die(2)], { critDice: [sneak()] });
		Object.assign(roll, { _evaluated: true, _evaluateASTSync: () => 0 });
		vi.spyOn(foundry.dice.Roll, 'fromData').mockImplementation((() => roll) as never);

		await changeOneDie(roll as never, { term: 0, result: 0 }, { mode: 'set', value: 2 });

		expect(lines(roll)).toEqual([]);
		expect(roll.critDiceKeys()).toEqual([]);
	});

	it('come when a change gives the crit', async () => {
		const roll = await attack([die(3)], { critDice: [sneak('1d6')] });
		Object.assign(roll, { _evaluated: true, _evaluateASTSync: () => 0 });
		vi.spyOn(foundry.dice.Roll, 'fromData').mockImplementation((() => roll) as never);
		diceToRoll([die(4)]);

		const changed = await changeOneDie(
			roll as never,
			{ term: 0, result: 0 },
			{ mode: 'set', value: 6 },
			{ draw: async () => 1 },
		);

		expect(lines(roll)).toEqual(['Sneak Attack:critBonus:4=4']);
		expect(changed.thrown).not.toBeNull();
	});

	it('throw the die the d20 replaces, then the d20', async () => {
		const roll = await attack([die(3)], { critD20: true });
		Object.assign(roll, { _evaluated: true, _evaluateASTSync: () => 0 });
		vi.spyOn(foundry.dice.Roll, 'fromData')
			.mockImplementationOnce((() => roll) as never)
			.mockImplementation(((data: unknown) => data) as never);
		diceToRoll([die(13)]);

		const changed = await changeOneDie(
			roll as never,
			{ term: 0, result: 0 },
			{ mode: 'set', value: 6 },
			{ draw: async () => 1 },
		);

		const thrown = changed.thrown as unknown as {
			terms: { faces: number; results: Result[] }[];
		};
		expect(thrown.terms.map((term) => [term.faces, term.results.map((r) => r.result)])).toEqual([
			[6, [1]],
			[20, [13]],
		]);
	});

	it('are listed for a picker, with their role', async () => {
		diceToRoll([die(3), die(7)]);

		const roll = await attack([die(6, { exploded: true }), die(2)], { critDice: [sneak()] });

		expect(pickableDice(roll as never).filter((d) => d.dieRole === 'critBonus')).toHaveLength(2);
	});

	it('all go to their max for a failed save, and can come back', async () => {
		diceToRoll([die(3), die(7)]);
		const roll = await attack([die(6, { exploded: true }), die(2)], { critDice: [sneak()] });
		Object.assign(roll, { _evaluated: true, _evaluateASTSync: () => 0 });

		const before = roll.setRoleDiceToMax('critBonus');

		expect(lines(roll)).toEqual(['Sneak Attack:critBonus:8+8=16']);
		roll.restoreRoleDice('critBonus', before);
		expect(lines(roll)).toEqual(['Sneak Attack:critBonus:3+7=10']);
	});
});
