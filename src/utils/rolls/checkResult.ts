import { checkRollOfCard, keptD20 } from '../reroll/checkCardRollTarget.ts';
import type { CheckRollKind } from '../reroll/rollToReroll.ts';
import { resultChangesOf, resultTotal, standingResultChanges } from './resultChanges.ts';

type CheckResult = 'failed' | 'succeeded';

/**
 * The result of a check card, or null when nothing settles it. A total that
 * meets the DC succeeds. On a save or a skill check, a natural 1 fails and a
 * natural 20 succeeds, with or without a DC.
 */
function checkResult(input: {
	kind: CheckRollKind;
	total: number;
	keptD20: number | null;
	dc?: number | null | undefined;
}): CheckResult | null {
	const { kind, total, keptD20, dc } = input;

	if (kind !== 'abilityCheck') {
		if (keptD20 === 1) return 'failed';
		if (keptD20 === 20) return 'succeeded';
	}
	if (typeof dc !== 'number') return null;

	return total >= dc ? 'succeeded' : 'failed';
}

/**
 * The result of a card's first roll, or null when it is not a check card or nothing
 * settles it. The total counts the card's Change a Result clicks. A succeed settles
 * the result. A set total replaces the roll, so no natural 1 or 20 is left to read.
 */
function checkResultOfCard(
	type: string,
	system: Record<string, unknown>,
	roll: { total?: number | null; terms: unknown[] } | undefined,
): CheckResult | null {
	const kind = checkRollOfCard(type, system)?.kind;
	if (!roll || !kind) return null;

	const changes = resultChangesOf(system);
	const standing = standingResultChanges(changes);
	if (standing.some((change) => change.change === 'succeed')) return 'succeeded';

	return checkResult({
		kind,
		total: resultTotal(roll.total ?? 0, changes),
		keptD20: standing.some((change) => change.change === 'setTotal') ? null : keptD20(roll.terms),
		dc: system.dc as number | null | undefined,
	});
}

export { checkResult, checkResultOfCard, type CheckResult };
