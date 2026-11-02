import type { CritDiceSpec } from '#types/critDice.d.ts';
import type { ExplosionStyle } from './oneDieReroll.js';
import { PrimaryDie } from './terms/PrimaryDie.js';

const Terms = foundry.dice.terms;

/** The options of a die term a crit added. */
export interface CritDiceOptions {
	flavor?: string;
	dieRole?: string;
	critDiceKey?: string;
}

/** Structural view of a damage roll, so this module has no import cycle with it. */
export interface CritDiceRoll {
	terms: foundry.dice.Roll['terms'];
	isCritical: boolean | undefined;
	options: {
		critD20?: boolean;
		critDice?: CritDiceSpec[];
		explosionStyle?: ExplosionStyle;
	};
	resetFormula(): unknown;
	critDiceKeys(): string[];
	addCritDice(spec: CritDiceSpec): Promise<number[]>;
	replaceCritDieWithD20(): Promise<{ drawn: number[] } | null>;
}

/** Sets the total of the roll again after a change of its dice. */
type RecalculateTotal = () => void;

function critDiceTermsOf(roll: CritDiceRoll): foundry.dice.terms.Die[] {
	return roll.terms.filter(
		(term): term is foundry.dice.terms.Die =>
			term instanceof Terms.Die && !!(term.options as CritDiceOptions)?.dieRole,
	);
}

/** Roll `count` dice of `faces` as a Foundry roll. */
async function rollDice(
	count: number,
	faces: number,
	modifier = '',
): Promise<foundry.dice.terms.DiceTerm.Result[]> {
	const roll = new Roll(`${count}d${faces}${modifier}`);
	await roll.evaluate();
	const term = roll.terms.find((t) => t instanceof Terms.Die) as foundry.dice.terms.Die | undefined;
	return term?.results ?? [];
}

/** Roll pairs of Vicious crit dice while the last die that can go on is at the max. */
async function rollViciousChain(dieTerm: foundry.dice.terms.Die, faces: number): Promise<void> {
	let lastLeft = faces;
	for (let i = 0; lastLeft === faces && i < 100; i++) {
		const [left, right] = await rollDice(2, faces);
		if (!left || !right) return;
		Object.assign(left, { provenance: 'viciousChain' });
		Object.assign(right, { provenance: 'viciousBonus' });
		dieTerm.results.push(left, right);
		lastLeft = left.result;
		if (lastLeft === faces) left.exploded = true;
	}
}

function removeCritDice(
	roll: CritDiceRoll,
	recalculateTotal: RecalculateTotal,
	key?: string,
): void {
	const dice = critDiceTermsOf(roll).filter(
		(term) => !key || (term.options as CritDiceOptions).critDiceKey === key,
	);
	if (dice.length < 1) return;
	for (const term of dice) {
		const at = roll.terms.indexOf(term);
		roll.terms.splice(Math.max(0, at - 1), 2);
	}
	roll.resetFormula();
	recalculateTotal();
}

/** Roll the crit dice from the options that the roll has not rolled, or take them off a roll with no crit. */
export async function settleCritDice(
	roll: CritDiceRoll,
	recalculateTotal: RecalculateTotal,
): Promise<number[]> {
	const drawn: number[] = [];
	if (roll.options.critD20 && roll.isCritical) {
		const made = await roll.replaceCritDieWithD20();
		drawn.push(...(made?.drawn ?? []));
	}
	if (roll.isCritical) {
		for (const spec of roll.options.critDice ?? []) {
			if (roll.critDiceKeys().includes(spec.key)) continue;
			drawn.push(...(await roll.addCritDice(spec)));
		}
	} else {
		removeCritDice(roll, recalculateTotal);
	}
	return drawn;
}

/** With Feature Effects off: a row adds the crit dice of a rule, for later changes too. */
export async function addCritDiceTo(
	roll: CritDiceRoll,
	spec: CritDiceSpec,
): Promise<{ term: PrimaryDie; drawn: number[] } | null> {
	const term = roll.terms.find((candidate) => candidate instanceof PrimaryDie);
	if (!term || !roll.isCritical || roll.critDiceKeys().includes(spec.key)) return null;
	roll.options.critDice = [...(roll.options.critDice ?? []), spec];
	return { term, drawn: await roll.addCritDice(spec) };
}

/** Roll the dice of `spec` as a line of their own. The dice it rolled. */
export async function addCritDice(
	roll: CritDiceRoll,
	spec: CritDiceSpec,
	recalculateTotal: RecalculateTotal,
): Promise<number[]> {
	const specRoll = new Roll(spec.formula);
	await specRoll.evaluate();
	const dice = specRoll.terms.filter((t) => t instanceof Terms.Die) as foundry.dice.terms.Die[];
	for (const term of dice) {
		Object.assign(term.options, {
			flavor: spec.label,
			dieRole: spec.role,
			critDiceKey: spec.key,
		});
		roll.terms.push(new Terms.OperatorTerm({ operator: '+' }), term);
		Object.assign(roll.terms.at(-2) as object, { _evaluated: true });
	}
	roll.resetFormula();
	recalculateTotal();
	return dice.flatMap((term) => term.results.map((result) => result.result));
}

/** The rules whose crit dice are on this roll. */
export function critDiceKeys(roll: CritDiceRoll): string[] {
	const keys = critDiceTermsOf(roll).map((term) => (term.options as CritDiceOptions).critDiceKey);
	return [...new Set(keys)].filter((key): key is string => !!key);
}

/** Every die of this role goes to its max. The old faces, for `restoreRoleDice`. */
export function setRoleDiceToMax(
	roll: CritDiceRoll,
	role: string,
	recalculateTotal: RecalculateTotal,
): number[] {
	const before: number[] = [];
	for (const term of critDiceTermsOf(roll)) {
		if ((term.options as CritDiceOptions).dieRole !== role) continue;
		for (const result of term.results) {
			before.push(result.result);
			result.result = term.faces ?? result.result;
		}
	}
	recalculateTotal();
	return before;
}

/** The dice of this role get back the faces `setRoleDiceToMax` gave. */
export function restoreRoleDice(
	roll: CritDiceRoll,
	role: string,
	faces: readonly number[],
	recalculateTotal: RecalculateTotal,
): void {
	const queue = [...faces];
	for (const term of critDiceTermsOf(roll)) {
		if ((term.options as CritDiceOptions).dieRole !== role) continue;
		for (const result of term.results) result.result = queue.shift() ?? result.result;
	}
	recalculateTotal();
}

/** Take the crit dice of one rule off the roll: its use went elsewhere this turn. */
export function dropCritDice(
	roll: CritDiceRoll,
	key: string,
	recalculateTotal: RecalculateTotal,
): void {
	removeCritDice(roll, recalculateTotal, key);
	roll.options.critDice = (roll.options.critDice ?? []).filter((spec) => spec.key !== key);
}

/** Reroll the first crit die as a d20, and what it starts. Null when there is none or it is one. */
export async function replaceCritDieWithD20(
	roll: CritDiceRoll,
	modifierModeCritTerm: () => foundry.dice.terms.Die | undefined,
	recalculateTotal: RecalculateTotal,
): Promise<{
	term: foundry.dice.terms.Die;
	drawn: number[];
} | null> {
	const term =
		roll.terms.find((candidate) => candidate instanceof PrimaryDie) ?? modifierModeCritTerm();
	if (!term || !roll.isCritical) return null;
	const at = Number(term.number) || 1;
	const first = term.results[at];
	if (!first || term.results.some((result) => (result as { faces?: number }).faces)) return null;

	const vicious = roll.options.explosionStyle === 'vicious';
	const drawn: number[] = [];
	const rolled = await rollDice(1, 20);
	const value = rolled[0]?.result ?? 1;
	drawn.push(value);
	const d20 = {
		result: value,
		active: true,
		faces: 20,
		...(vicious ? { provenance: 'viciousChain' } : {}),
	} as foundry.dice.terms.DiceTerm.Result;
	term.results.splice(at, vicious ? 1 : term.results.length - at, d20);
	if (vicious) term.results.splice(at + 2);

	if (value === 20) {
		d20.exploded = true;
		const faces = term.faces ?? 6;
		if (vicious) {
			const before = term.results.length;
			await rollViciousChain(term, faces);
			drawn.push(...term.results.slice(before).map((result) => result.result));
		} else {
			const chain = await rollDice(1, faces, 'x');
			term.results.push(...chain);
			drawn.push(...chain.map((result) => result.result));
		}
	}
	roll.resetFormula();
	recalculateTotal();
	return { term, drawn };
}

/**
 * Make a standard crit Vicious after it is rolled: each crit die gets the
 * Vicious die. Null when the roll is no crit, or is Vicious.
 */
export async function makeVicious(
	roll: CritDiceRoll,
	recalculateTotal: RecalculateTotal,
): Promise<{ term: PrimaryDie; drawn: number[] } | null> {
	const term = roll.terms.find((candidate) => candidate instanceof PrimaryDie);
	if (!term || !roll.isCritical || roll.options.explosionStyle === 'vicious') return null;
	const at = Number(term.number) || 1;
	const chain = term.results.slice(at);
	if (chain.length < 1) return null;

	const extra = await rollDice(chain.length, term.faces ?? 6);
	term.results = [
		...term.results.slice(0, at),
		...chain.flatMap((die, index) => [
			Object.assign(die, { provenance: 'viciousChain' }),
			Object.assign(extra[index], { provenance: 'viciousBonus' }),
		]),
	];
	term.modifiers = term.modifiers.filter((modifier) => !/^xo?$/i.test(modifier));
	roll.options.explosionStyle = 'vicious';
	roll.resetFormula();
	recalculateTotal();
	return { term, drawn: extra.map((die) => die.result) };
}
