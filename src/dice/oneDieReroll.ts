import {
	changeDieInTerm,
	type DieTermLike,
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
}

interface RollLike {
	terms: readonly unknown[];
	primaryDie?: unknown;
	options?: { brutalPrimary?: boolean };
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
				faces: term.faces,
				value: result.result,
				role,
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

interface OneDieRoll {
	terms: unknown[];
	toJSON(): object;
	explosionStyleOf?(term: unknown): ExplosionStyle;
	refreshOutcome?(): void;
	/** "Add to Primary Die Result" when `term` is the Primary Die and has it. */
	primaryDieBonusOf?(term: unknown): KeptDieBonus | null;
	/** The Primary Die `term` was rolled again; `keptBase` is its new result before the bonus. */
	primaryDieRerolled?(term: unknown, keptBase: number | null): void;
	/** The kept Primary Die `term` got a final face; gives the bonus a set value dropped. */
	primaryDieChanged?(term: unknown, value: number, mode: DieChange['mode']): number;
}

/** A change to one die: set it to a face, or add a number (which may be negative) to it. */
interface DieChange {
	mode: 'set' | 'add';
	value: number;
}

function hasExplodeModifier(modifiers: readonly string[] = []): boolean {
	return modifiers.some((modifier) => /^xo?(?![a-z])/i.test(modifier));
}

/** A roll of only the dice a one-die reroll rolled, for the 3D dice to throw. */
function thrownDice(term: DieTermLike & { options?: object }, drawn: number[]): foundry.dice.Roll {
	return foundry.dice.Roll.fromData({
		class: 'Roll',
		formula: `${drawn.length}d${term.faces}`,
		terms: [
			{
				class: 'Die',
				number: drawn.length,
				faces: term.faces,
				modifiers: [],
				options: { ...(term.options ?? {}) },
				results: drawn.map((result) => ({ result, active: true })),
				evaluated: true,
			},
		],
		total: drawn.reduce((sum, value) => sum + value, 0),
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
	const copy = foundry.dice.Roll.fromData(
		foundry.utils.deepClone(roll.toJSON()) as never,
	) as unknown as TRoll;
	const term = copy.terms[ref.term];
	if (!isDieTerm(term)) throw new Error(`The roll has no dice term ${ref.term}.`);

	const style =
		copy.explosionStyleOf?.(term) ?? (hasExplodeModifier(term.modifiers) ? 'standard' : 'none');
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
	);
	copy.primaryDieRerolled?.(term, changed.keptBase);

	refreshTotals(copy);

	return {
		roll: copy,
		faces: term.faces,
		previous: changed.previous,
		next: changed.next,
		dropped,
		thrown: thrownDice(term, dropped === null ? changed.drawn : [...changed.drawn, dropped]),
	};
}

/**
 * Change one die of an evaluated roll to a new face, from 1 to the die's max.
 * The old roll is not changed: the new roll is a copy with the die changed and
 * its total, crit and miss worked out again. The die keeps its place (the
 * keep is not worked out again). Dice a new max explodes into are rolled;
 * `thrown` holds only those, or is null when none were rolled. On the kept
 * Primary Die, a set value drops the "Add to Primary Die Result" bonus, and
 * `bonusNotAdded` says how much.
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
	bonusNotAdded: number;
	thrown: foundry.dice.Roll | null;
}> {
	const copy = foundry.dice.Roll.fromData(
		foundry.utils.deepClone(roll.toJSON()) as never,
	) as unknown as TRoll;
	const term = copy.terms[ref.term];
	if (!isDieTerm(term)) throw new Error(`The roll has no dice term ${ref.term}.`);
	const result = term.results[ref.result];
	if (!result) throw new Error(`The dice term has no result ${ref.result}.`);

	const style =
		copy.explosionStyleOf?.(term) ?? (hasExplodeModifier(term.modifiers) ? 'standard' : 'none');
	const wanted = change.mode === 'set' ? change.value : result.result + change.value;
	const face = Math.min(term.faces, Math.max(1, Math.trunc(wanted)));
	const kept = isActive(result);
	const changed = await changeDieInTerm(
		term,
		ref.result,
		style,
		face,
		options.draw ?? rollOneDieFace,
	);
	const bonusNotAdded =
		kept && changed.next !== changed.previous
			? (copy.primaryDieChanged?.(term, changed.next, change.mode) ?? 0)
			: 0;

	refreshTotals(copy);

	return {
		roll: copy,
		faces: term.faces,
		previous: changed.previous,
		next: changed.next,
		bonusNotAdded,
		thrown: changed.drawn.length > 0 ? thrownDice(term, changed.drawn) : null,
	};
}

export {
	changeOneDie,
	type DieChange,
	type DieRef,
	type DieTermLike,
	type ExplosionStyle,
	type KeptDieBonus,
	type OneDieRoll,
	type PickableDie,
	type PickableRole,
	hasExplodeModifier,
	pickableDice,
	primaryDieRef,
	rerollOneDie,
};
