import { ASSESS_DC } from '../assessOptions.js';
import { keptD20 } from '../reroll/checkRollOfCard.js';
import { resultOfCheckRoll } from '../rolls/checkResult.js';
import { naturalResultChange } from '../rolls/resultChanges.js';

/**
 * Whether an Assess roll succeeds, read as a skill check card of that skill against
 * the Assess DC. A rule of the roller that makes a low result a natural 20 counts.
 */
export function assessSucceeds(
	roll: { total?: number | null; terms: unknown[] },
	roller: { uuid?: string | null; rules?: unknown } | null | undefined,
	skillKey: string,
): boolean {
	const check = { kind: 'skillCheck', key: skillKey } as const;
	const rollTotal = roll.total ?? 0;
	const natural = naturalResultChange({
		roller,
		roll: check,
		rollTotal,
		keptD20: keptD20(roll.terms),
	});
	const result = resultOfCheckRoll({
		kind: check.kind,
		rollTotal,
		terms: roll.terms,
		changes: natural ? [natural] : [],
		dc: ASSESS_DC,
	});
	return result === 'succeeded';
}
