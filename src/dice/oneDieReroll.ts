import type { CritDiceSpec } from '#types/critDice.d.ts';
import type { DieChange } from '#types/dieChange.d.ts';
import type { RollEffect } from '../utils/incomingReactions/incomingReactionEntry.js';
import { dieRoleOf, isCritD20Result } from './critDiceLines.js';
import {
	changeDieInTerm,
	type DieTermLike,
	dieFaces,
	type ExplosionStyle,
	isActive,
	type KeptDieBonus,
	rerollDieInTerm,
} from './rerollDieInTerm.js';

/** A die on a roll: the index of its term in `roll.terms` and of its result in that term. */
interface DieRef {
	term: number;
	result: number;
}

type PickableRole = 'primary' | 'kept' | 'dropped' | 'explosion';

interface PickableDie extends DieRef {
	faces: number;
	value: number;
	role: PickableRole;
	/** What other features call this die. */
	dieRole?: string;
	/** The number a set value of the die gets, on the Primary Die only. */
	bonus?: number;
}

interface PrimaryDieBonusRoll {
	primaryDie?: unknown;
	modifierMode?: boolean;
	options?: {
		brutalPrimary?: boolean;
		primaryDieModifier?: unknown;
		primaryDieBonusOff?: boolean;
	};
}

interface RollLike extends PrimaryDieBonusRoll {
	terms: readonly unknown[];
}

/** The number added to the face of the roll's Primary Die, or 0. */
function primaryDieBonus(roll: PrimaryDieBonusRoll): number {
	if (!roll.primaryDie || roll.modifierMode) return 0;
	return Math.trunc(Number(roll.options?.primaryDieModifier) || 0);
}

function isDieTerm(term: unknown): term is DieTermLike {
	const candidate = term as Partial<DieTermLike> | null;
	return typeof candidate?.faces === 'number' && Array.isArray(candidate.results);
}

/**
 * The dice a player can pick to reroll: every die that counts, explosion dice
 * included. Dropped dice only of the term `droppedFrom` names.
 */
function pickableDice(roll: RollLike, options: { droppedFrom?: number } = {}): PickableDie[] {
	const primary = primaryDieRef(roll);
	const bonus = primaryDieBonus(roll);
	const dice: PickableDie[] = [];
	roll.terms.forEach((term, termIndex) => {
		if (!isDieTerm(term)) return;
		term.results.forEach((result, resultIndex) => {
			const counts = isActive(result);
			if (!counts && options.droppedFrom !== termIndex) return;
			let role: PickableRole = 'kept';
			if (!counts) role = 'dropped';
			else if (primary?.term === termIndex && primary.result === resultIndex && roll.primaryDie)
				role = 'primary';
			else if (resultIndex >= term.number) role = 'explosion';
			dice.push({
				term: termIndex,
				result: resultIndex,
				faces: dieFaces(result, term),
				value: result.result,
				role,
				...(role === 'primary' && bonus ? { bonus } : {}),
				...(dieRoleOf(term) ? { dieRole: dieRoleOf(term) } : {}),
			});
		});
	});
	return dice;
}

/** The kept result of the roll's Primary Die, or of a check's d20. */
function primaryDieRef(roll: RollLike): DieRef | null {
	const termIndex = roll.primaryDie
		? roll.terms.indexOf(roll.primaryDie)
		: roll.terms.findIndex((term) => isDieTerm(term) && term.faces === 20);
	const term = roll.terms[termIndex];
	if (!isDieTerm(term)) return null;

	let best = -1;
	term.results.forEach((result, index) => {
		if (!isActive(result)) return;
		if (best === -1) best = index;
		else if (roll.options?.brutalPrimary && result.result > term.results[best].result) best = index;
	});
	return best === -1 ? null : { term: termIndex, result: best };
}

interface OneDieRoll extends PrimaryDieBonusRoll {
	terms: unknown[];
	toJSON(): object;
	explosionStyleOf?(term: unknown): ExplosionStyle;
	/** The lowest kept face of `term` that is a crit. */
	critFaceOf?(term: unknown): number;
	refreshOutcome?(): void;
	/** Make the roll a crit that stays; null when it cannot be one. */
	makeCritical?(): Promise<{ term: unknown; drawn: number[] } | null>;
	/** Reroll the first crit die as a d20; null when there is none or it is one. */
	replaceCritDieWithD20?(): Promise<{ term: unknown; drawn: number[] } | null>;
	/** Give each crit die the Vicious die; null when the roll is no crit or is Vicious. */
	makeVicious?(): Promise<{ term: unknown; drawn: number[] } | null>;
	/** Add the crit dice of a rule to this roll, for later changes too. */
	addCritDiceTo?(spec: CritDiceSpec): Promise<{ term: unknown; drawn: number[] } | null>;
	/** Roll the crit dice a change of the roll now calls for; the dice it rolled. */
	settleCritDice?(): Promise<number[]>;
	/** "Add to Primary Die Result" when `term` is the Primary Die and has it. */
	primaryDieBonusOf?(term: unknown): KeptDieBonus | null;
	/** The Primary Die `term` was rolled again; `keptBase` is its new result before the bonus. */
	primaryDieRerolled?(term: unknown, keptBase: number | null): void;
	/**
	 * The kept Primary Die `term` got a new face; `base` is that face before the
	 * bonus. With `bonusOnFace` false, the face holds no bonus.
	 */
	primaryDieChanged?(term: unknown, base: number, bonusOnFace?: boolean): void;
}

function hasExplodeModifier(modifiers: readonly string[] = []): boolean {
	return modifiers.some((modifier) => /^xo?(?![a-z])/i.test(modifier));
}

/** The explosion style a term's own modifiers give, with no roll to say more. */
function modifierExplosionStyle(modifiers: readonly string[] = []): ExplosionStyle {
	return hasExplodeModifier(modifiers) ? 'standard' : 'none';
}

/** The value of the d20 crit die in a roll, if it has one. */
function d20CritValue(roll: OneDieRoll): number | null {
	for (const term of roll.terms) {
		if (!isDieTerm(term)) continue;
		const d20 = term.results.find(isCritD20Result);
		if (d20) return d20.result;
	}
	return null;
}

/** The value of a d20 crit die that the change rolled. */
function newD20Crit(before: number | null, roll: OneDieRoll): number | null {
	const after = d20CritValue(roll);
	return after === before ? null : after;
}

/** A roll of only the dice a one-die reroll rolled, for the 3D dice to throw. */
function thrownDice(
	term: DieTermLike & { options?: object },
	drawn: number[],
	d20: number | null = null,
): foundry.dice.Roll {
	const same = [...drawn];
	const at = d20 === null ? -1 : same.indexOf(d20);
	if (at >= 0) same.splice(at, 1);
	const groups = [
		{ faces: term.faces, values: same },
		{ faces: 20, values: at >= 0 ? [d20 as number] : [] },
	].filter((group) => group.values.length > 0);
	return foundry.dice.Roll.fromData({
		class: 'Roll',
		formula: groups.map((group) => `${group.values.length}d${group.faces}`).join(' + '),
		terms: groups.map((group) => ({
			class: 'Die',
			number: group.values.length,
			faces: group.faces,
			modifiers: [],
			options: { ...(term.options ?? {}) },
			results: group.values.map((result) => ({ result, active: true })),
			evaluated: true,
		})),
		total: drawn.reduce((sum, value) => sum + value, 0),
		evaluated: true,
	} as never) as foundry.dice.Roll;
}

/** The dice of several one-die rerolls as one roll, so they are thrown together. */
function thrownTogether(rolls: readonly foundry.dice.Roll[]): foundry.dice.Roll | null {
	if (rolls.length <= 1) return rolls[0] ?? null;
	const data = rolls.map(
		(roll) => roll.toJSON() as unknown as { formula: string; terms: object[] },
	);
	return foundry.dice.Roll.fromData({
		class: 'Roll',
		formula: data.map((each) => each.formula).join(' + '),
		terms: data.flatMap((each) => each.terms),
		total: rolls.reduce((sum, roll) => sum + (roll.total ?? 0), 0),
		evaluated: true,
	} as never) as foundry.dice.Roll;
}

/** Work out the copy's total, crit and miss again after one of its dice changed. */
function refreshTotals(copy: OneDieRoll): void {
	if (copy.refreshOutcome) {
		copy.refreshOutcome();
		return;
	}
	const internals = copy as unknown as {
		_total: number;
		_evaluateASTSync(node: unknown): number;
	};
	internals._total = internals._evaluateASTSync(CONFIG.Dice.parser.toAST(copy.terms as never));
}

/** One die rolled as a Foundry roll, so manual dice entry and dice modules can give its result. */
async function rollOneDieFace(faces: number): Promise<number> {
	const roll = new foundry.dice.Roll(`1d${faces}`);
	await roll.evaluate();
	return roll.total ?? 0;
}

/**
 * Reroll one die of an evaluated roll. The old roll is not changed: the new
 * roll is a copy with that die rolled again and its total, crit and miss
 * worked out again. `thrown` holds only the dice this reroll rolled. With a
 * `rollModeChange` of 1 the die is rolled two times and the higher stays (-1:
 * the lower); `dropped` is the other result. Dice its max explodes into are
 * rolled once.
 */
async function rerollOneDie<TRoll extends OneDieRoll>(
	roll: TRoll,
	ref: DieRef,
	options: { rollModeChange?: number; draw?: (faces: number) => Promise<number> } = {},
): Promise<{
	roll: TRoll;
	faces: number;
	previous: number;
	next: number;
	dropped: number | null;
	thrown: foundry.dice.Roll;
}> {
	const d20Before = d20CritValue(roll);
	const copy = cloneRoll(roll);
	const term = copy.terms[ref.term];
	if (!isDieTerm(term)) throw new Error(`The roll has no dice term ${ref.term}.`);

	const style = copy.explosionStyleOf?.(term) ?? modifierExplosionStyle(term.modifiers);
	const draw = options.draw ?? rollOneDieFace;
	const mode = Math.sign(Number(options.rollModeChange) || 0);
	let dropped: number | null = null;
	let first = true;
	const drawWithMode = async (faces: number) => {
		const value = await draw(faces);
		if (!first || mode === 0) return value;
		first = false;
		const other = await draw(faces);
		const stays = mode > 0 ? Math.max(value, other) : Math.min(value, other);
		dropped = stays === value ? other : value;
		return stays;
	};
	const changed = await rerollDieInTerm(
		term,
		ref.result,
		style,
		drawWithMode,
		copy.primaryDieBonusOf?.(term) ?? null,
		copy.critFaceOf?.(term) ?? term.faces,
	);
	copy.primaryDieRerolled?.(term, changed.keptBase);

	refreshTotals(copy);
	const settled = (await copy.settleCritDice?.()) ?? [];

	const rolled = [...changed.drawn, ...settled];
	return {
		roll: copy,
		faces: term.faces,
		previous: changed.previous,
		next: changed.next,
		dropped,
		thrown: thrownDice(
			term,
			dropped === null ? rolled : [...rolled, dropped],
			newD20Crit(d20Before, copy),
		),
	};
}

/**
 * Change one die of an evaluated roll to a new face, from 1 to the die's max.
 * The old roll is not changed: the new roll is a copy with the die changed and
 * its total, crit and miss worked out again. The die keeps its place (the
 * keep is not worked out again). Dice a new max explodes into are rolled;
 * `thrown` holds only those, or is null when none were rolled. A set value is
 * the final face, with no Primary Die bonus, unless the change `addsBonus`
 * (then up to the max). An add moves the face as it is, bonus or no bonus.
 */
async function changeOneDie<TRoll extends OneDieRoll>(
	roll: TRoll,
	ref: DieRef,
	change: DieChange,
	options: { draw?: (faces: number) => Promise<number> } = {},
): Promise<{
	roll: TRoll;
	faces: number;
	previous: number;
	next: number;
	thrown: foundry.dice.Roll | null;
}> {
	const d20Before = d20CritValue(roll);
	const copy = cloneRoll(roll);
	const term = copy.terms[ref.term];
	if (!isDieTerm(term)) throw new Error(`The roll has no dice term ${ref.term}.`);
	const result = term.results[ref.result];
	if (!result) throw new Error(`The dice term has no result ${ref.result}.`);

	const style = copy.explosionStyleOf?.(term) ?? modifierExplosionStyle(term.modifiers);
	// An explosion die never holds the bonus.
	const kept = isActive(result) && ref.result < term.number;
	const bonus = kept ? (copy.primaryDieBonusOf?.(term) ?? null) : null;
	const bonusOnFace =
		change.mode === 'set' ? change.addsBonus === true : copy.options?.primaryDieBonusOff !== true;
	const add = bonusOnFace ? (bonus?.add ?? 0) : 0;
	const faces = dieFaces(result, term);
	const clamp = (value: number) => Math.min(faces, Math.max(1, Math.trunc(value)));
	const base =
		change.mode === 'set' ? clamp(change.value) : clamp(result.result + change.value - add);
	const face = change.mode === 'set' ? clamp(base + add) : clamp(result.result + change.value);
	const changed = await changeDieInTerm(
		term,
		ref.result,
		style,
		face,
		options.draw ?? rollOneDieFace,
		copy.critFaceOf?.(term) ?? term.faces,
	);
	if (kept) copy.primaryDieChanged?.(term, bonus ? base : changed.next, bonusOnFace);

	refreshTotals(copy);
	const settled = (await copy.settleCritDice?.()) ?? [];

	const rolled = [...changed.drawn, ...settled];
	return {
		roll: copy,
		faces: term.faces,
		previous: changed.previous,
		next: changed.next,
		thrown: rolled.length > 0 ? thrownDice(term, rolled, newD20Crit(d20Before, copy)) : null,
	};
}

function cloneRoll<TRoll extends OneDieRoll>(roll: TRoll): TRoll {
	return foundry.dice.Roll.fromData(
		foundry.utils.deepClone(roll.toJSON()) as never,
	) as unknown as TRoll;
}

/**
 * Make an evaluated roll a crit that stays. The old roll is not changed: the
 * new roll is a copy with the crit dice rolled. `thrown` holds only those, or
 * is null when none were rolled. Throws when the roll cannot be made a crit.
 */
async function makeRollCrit<TRoll extends OneDieRoll>(
	roll: TRoll,
): Promise<{ roll: TRoll; faces: number; next: number | null; thrown: foundry.dice.Roll | null }> {
	const d20Before = d20CritValue(roll);
	const copy = cloneRoll(roll);
	const made = await copy.makeCritical?.();
	if (!made || !isDieTerm(made.term)) throw new Error('The roll cannot be made a crit.');
	const settled = (await copy.settleCritDice?.()) ?? [];
	const ref = primaryDieRef(copy);
	const kept = ref ? (copy.terms[ref.term] as DieTermLike).results[ref.result]?.result : null;

	const rolled = [...made.drawn, ...settled];
	return {
		roll: copy,
		faces: made.term.faces,
		next: kept ?? null,
		thrown: rolled.length > 0 ? thrownDice(made.term, rolled, newD20Crit(d20Before, copy)) : null,
	};
}

/**
 * Do a row's effect on an evaluated roll. The old roll is not changed: the new
 * roll is a copy. `thrown` holds only the dice rolled. Throws when the effect has
 * nothing to do.
 */
async function applyRollEffect<TRoll extends OneDieRoll>(
	roll: TRoll,
	effect: RollEffect,
	critDice: CritDiceSpec | null = null,
): Promise<{ roll: TRoll; faces: number; next: number | null; thrown: foundry.dice.Roll | null }> {
	const d20Before = d20CritValue(roll);
	const copy = cloneRoll(roll);
	let made: { term: unknown; drawn: number[] } | null | undefined;
	if (effect === 'critD20') made = await copy.replaceCritDieWithD20?.();
	else if (effect === 'viciousDie') made = await copy.makeVicious?.();
	else if (critDice) made = await copy.addCritDiceTo?.(critDice);
	if (!made || !isDieTerm(made.term)) throw new Error('The roll effect has nothing to do.');
	const ref = primaryDieRef(copy);
	const kept = ref ? (copy.terms[ref.term] as DieTermLike).results[ref.result]?.result : null;

	return {
		roll: copy,
		faces: made.term.faces,
		next: kept ?? null,
		thrown:
			made.drawn.length > 0 ? thrownDice(made.term, made.drawn, newD20Crit(d20Before, copy)) : null,
	};
}

/**
 * Add an offer bonus to an evaluated roll: the Primary Die goes up, so crit and
 * miss are read again. The old roll is not changed.
 */
async function applyOfferBonus<TRoll extends OneDieRoll>(
	roll: TRoll,
	primaryDie: number,
): Promise<{ roll: TRoll; faces: number; next: number | null; thrown: foundry.dice.Roll | null }> {
	const ref = primaryDieRef(roll);
	const die = ref ? (roll.terms[ref.term] as DieTermLike) : null;
	if (ref && primaryDie !== 0) {
		return changeOneDie(roll, ref, { mode: 'add', value: primaryDie });
	}
	return {
		roll: cloneRoll(roll),
		faces: die?.faces ?? 6,
		next: ref && die ? die.results[ref.result].result : null,
		thrown: null,
	};
}

export {
	applyOfferBonus,
	applyRollEffect,
	changeOneDie,
	makeRollCrit,
	type DieRef,
	type DieTermLike,
	type ExplosionStyle,
	type KeptDieBonus,
	type OneDieRoll,
	type PickableDie,
	type PickableRole,
	type PrimaryDieBonusRoll,
	modifierExplosionStyle,
	pickableDice,
	primaryDieBonus,
	primaryDieRef,
	rerollOneDie,
	thrownTogether,
};
