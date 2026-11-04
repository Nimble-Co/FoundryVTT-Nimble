import { ASSESS_DC } from '../assessOptions.js';
import { keptD20 } from '../reroll/checkRollOfCard.js';
import { checkResult } from '../rolls/checkResult.js';

/** Whether an Assess roll succeeds, read as any skill check against the Assess DC. */
export function assessSucceeds(roll: { total?: number | null; terms: unknown[] }): boolean {
	const result = checkResult({
		kind: 'skillCheck',
		total: roll.total ?? 0,
		keptD20: keptD20(roll.terms),
		dc: ASSESS_DC,
	});
	return result === 'succeeded';
}
