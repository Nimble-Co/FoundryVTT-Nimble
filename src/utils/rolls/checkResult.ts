import type { CheckResult } from '#types/checkResult.d.ts';
import type { ResultChange } from '#types/resultChange.d.ts';
import { checkRollOfCard, keptD20 } from '../reroll/checkRollOfCard.ts';
import type { CheckRollKind } from '../reroll/rollToReroll.ts';
import {
	NATURAL_20,
	resultChangesOf,
	resultTotal,
	standingResultChanges,
} from './resultChanges.ts';

const NATURAL_1_FAILS = 1;

/** A change that makes the roll succeed, whatever its dice. */
const settlesSuccess = (change: ResultChange) =>
	change.change === 'succeed' || change.change === 'countsAsNat20';

/** A change that replaces the roll, so no natural 1 or 20 is left to read. */
const replacesRoll = (change: ResultChange) => change.change === 'setTotal';

/** A save or a skill check: a natural 1 always fails and a natural 20 always succeeds. */
function naturalDieSettles(kind: CheckRollKind): boolean {
	return kind === 'save' || kind === 'skillCheck';
}

/**
 * The result of a check card, or null when nothing settles it. A total that
 * meets the DC succeeds. On a save or a skill check, a natural 1 fails and a
 * natural 20 succeeds, with or without a DC. Initiative has no result.
 */
function checkResult(input: {
	kind: CheckRollKind;
	total: number;
	keptD20: number | null;
	dc?: number | null | undefined;
}): CheckResult | null {
	const { kind, total, keptD20, dc } = input;

	if (kind === 'initiative') return null;
	if (naturalDieSettles(kind)) {
		if (keptD20 === NATURAL_1_FAILS) return 'failed';
		if (keptD20 === NATURAL_20) return 'succeeded';
	}
	if (typeof dc !== 'number') return null;

	return total >= dc ? 'succeeded' : 'failed';
}

/**
 * The result of a check roll with its changes on it, or null when nothing settles it.
 * A succeed, and a roll that counts as a natural 20, settle the result. A set total
 * replaces the roll, so no natural 1 or 20 is left to read.
 */
function resultOfCheckRoll(input: {
	kind: CheckRollKind;
	rollTotal: number;
	terms: unknown[];
	changes: readonly ResultChange[];
	dc?: number | null | undefined;
}): CheckResult | null {
	const { kind, rollTotal, terms, changes, dc } = input;
	const standing = standingResultChanges(changes);
	if (standing.some(settlesSuccess)) return 'succeeded';
	return checkResult({
		kind,
		total: resultTotal(rollTotal, changes),
		keptD20: standing.some(replacesRoll) ? null : keptD20(terms),
		dc,
	});
}

/**
 * Whether the roll fails on its natural 1 whatever is added to it: a save or a
 * skill check whose kept d20 is a 1, and no change on the card took that 1 off.
 */
function failsOnNaturalOne(input: {
	kind: CheckRollKind;
	terms: unknown[];
	changes: readonly ResultChange[];
}): boolean {
	const { kind, terms, changes } = input;
	if (!naturalDieSettles(kind)) return false;
	const settled = standingResultChanges(changes).some(
		(change) => settlesSuccess(change) || replacesRoll(change),
	);
	return !settled && keptD20(terms) === NATURAL_1_FAILS;
}

/** The result of a card's first roll, or null when it is not a check card or nothing settles it. */
function checkResultOfCard(
	type: string,
	system: Record<string, unknown>,
	roll: { total?: number | null; terms: unknown[] } | undefined,
): CheckResult | null {
	const kind = checkRollOfCard(type, system)?.kind;
	if (!roll || !kind) return null;

	return resultOfCheckRoll({
		kind,
		rollTotal: roll.total ?? 0,
		terms: roll.terms,
		changes: resultChangesOf(system),
		dc: system.dc as number | null | undefined,
	});
}

export { checkResult, checkResultOfCard, failsOnNaturalOne, resultOfCheckRoll };
