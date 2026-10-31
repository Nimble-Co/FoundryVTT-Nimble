import type { DieChange } from '#types/dieChange.d.ts';
import {
	changeOneDie,
	type DieRef,
	makeRollCrit,
	type OneDieRoll,
	type PickableDie,
	pickableDice,
	primaryDieRef,
	rerollOneDie,
} from '../../dice/oneDieReroll.js';
import type { ChangeableDie, RerollDie } from '../incomingReactions/incomingReactionEntry.js';
import type { RerollableRoll } from './rerollRollTarget.js';

function pickOptions(found: RerollableRoll<unknown>, current: OneDieRoll) {
	if (!found.pickDropped) return {};
	const d20 = current.terms.findIndex((term) => (term as { faces?: unknown })?.faces === 20);
	return d20 === -1 ? {} : { droppedFrom: d20 };
}

/** The dice of the card's roll a player can pick to reroll. */
function diceToPick(found: RerollableRoll<unknown>): PickableDie[] {
	const current = found.current?.();
	return current ? pickableDice(current, pickOptions(found, current)) : [];
}

/**
 * The dice a player picks from for a Change a Die rule: every pickable die, or
 * only the Primary Die. A die has a bonus only when `change` puts it on the new face.
 */
function diceForRule(
	found: RerollableRoll<unknown>,
	die: ChangeableDie,
	change: DieChange,
): PickableDie[] {
	const all = diceToPick(found);
	const current = found.current?.();
	const ref = die === 'primaryDie' && current ? primaryDieRef(current) : null;
	const dice =
		die === 'pickedDie' ? all : all.filter((d) => d.term === ref?.term && d.result === ref.result);
	if (change.mode !== 'set' || change.addsBonus) return dice;
	return dice.map(({ bonus: _bonus, ...rest }) => rest);
}

/**
 * The die of the card's roll a rule uses: its Primary Die, or the die the
 * player picked (the only one when the roll has one die). Null when that die
 * is not one the roll has, or a pick is needed and missing.
 */
function dieToUse(
	found: RerollableRoll<unknown>,
	current: OneDieRoll,
	die: ChangeableDie,
	picked: DieRef | null,
): DieRef | null {
	if (die === 'primaryDie') return primaryDieRef(current);
	const dice = pickableDice(current, pickOptions(found, current));
	const match = picked
		? dice.find((d) => d.term === picked.term && d.result === picked.result)
		: dice.length === 1
			? dice[0]
			: undefined;
	return match ? { term: match.term, result: match.result } : null;
}

function resultAt(current: OneDieRoll, ref: DieRef): number {
	const term = current.terms[ref.term] as { results: Array<{ result: number }> };
	return term.results[ref.result].result;
}

/**
 * The roll a rule rerolls: the whole roll, its Primary Die, or the die the
 * player picked. Null when that die is not one the roll has, or a pick is
 * needed and missing.
 */
function rerollableFor<TRoll>(
	found: RerollableRoll<TRoll>,
	die: RerollDie | undefined,
	picked: DieRef | null = null,
	reroll: typeof rerollOneDie = rerollOneDie,
): RerollableRoll<TRoll> | null {
	if (!die || die === 'wholeRoll') return found;
	const current = found.current?.();
	if (!current) return null;
	const dieRef = dieToUse(found, current, die, picked);
	if (!dieRef) return null;

	let made: Awaited<ReturnType<typeof rerollOneDie>> | null = null;
	return {
		...found,
		previousResult: resultAt(current, dieRef),
		makeRoll: async (_formula, _options, changes) => {
			made = await reroll(current, dieRef, {
				rollModeChange: Math.sign(Number(changes?.rollModeChange) || 0),
			});
			return made.roll as unknown as TRoll;
		},
		readNewDie: () => ({
			faces: made?.faces ?? null,
			value: made?.next ?? null,
			dropped: made?.dropped ?? null,
		}),
		diceToThrow: () => made?.thrown ?? null,
	};
}

/**
 * The roll a Change a Die rule changes, with the change made to its Primary
 * Die or to the die the player picked. Null when that die is not one the roll
 * has, or a pick is needed and missing. Only the dice a new max explodes into
 * are thrown.
 */
function changeableFor<TRoll>(
	found: RerollableRoll<TRoll>,
	die: ChangeableDie,
	picked: DieRef | null,
	change: DieChange,
	changer: typeof changeOneDie = changeOneDie,
): RerollableRoll<TRoll> | null {
	const current = found.current?.();
	if (!current) return null;
	const dieRef = dieToUse(found, current, die, picked);
	if (!dieRef) return null;

	let made: Awaited<ReturnType<typeof changeOneDie>> | null = null;
	return {
		...found,
		previousResult: resultAt(current, dieRef),
		makeRoll: async () => {
			made = await changer(current, dieRef, change);
			return made.roll as unknown as TRoll;
		},
		readNewDie: () => ({
			faces: made?.faces ?? null,
			value: made?.next ?? null,
			dropped: null,
		}),
		diceToThrow: () => made?.thrown ?? null,
	};
}

/**
 * The roll a Make It a Crit rule makes a crit, with the crit dice rolled. The
 * Primary Die keeps its face. Null when the card has no roll to change. Only
 * the crit dice are thrown.
 */
function critFor<TRoll>(
	found: RerollableRoll<TRoll>,
	maker: typeof makeRollCrit = makeRollCrit,
): RerollableRoll<TRoll> | null {
	const current = found.current?.();
	if (!current) return null;
	const ref = primaryDieRef(current);

	let made: Awaited<ReturnType<typeof makeRollCrit>> | null = null;
	return {
		...found,
		previousResult: ref ? resultAt(current, ref) : null,
		makeRoll: async () => {
			made = await maker(current);
			return made.roll as unknown as TRoll;
		},
		readNewDie: () => ({ faces: made?.faces ?? null, value: made?.next ?? null, dropped: null }),
		diceToThrow: () => made?.thrown ?? null,
	};
}

export { changeableFor, critFor, diceForRule, diceToPick, rerollableFor };
