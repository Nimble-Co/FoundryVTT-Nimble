import type { ResultChange } from '#types/resultChange.d.ts';
import { ASSESS_DC } from '../assessOptions.js';
import { resultOfCheckRoll } from '../rolls/checkResult.js';
import { naturalResultChangeOfRoll } from '../rolls/resultChanges.js';

type AssessRoll = { total?: number | null; terms: unknown[] };
type AssessRoller = { uuid?: string | null; rules?: unknown } | null | undefined;

interface AssessOutcome {
	isSuccess: boolean;
	/** The feature whose "counts as a natural 20" made the Assess succeed, or null. */
	countsAsNat20Feature: string | null;
}

function succeedsWith(roll: AssessRoll, changes: ResultChange[]): boolean {
	return (
		resultOfCheckRoll({
			kind: 'skillCheck',
			rollTotal: roll.total ?? 0,
			terms: roll.terms,
			changes,
			dc: ASSESS_DC,
		}) === 'succeeded'
	);
}

/** The name of the document that holds the rule that made the change, as the skill check card shows it. */
function featureNameOf(roller: AssessRoller, change: ResultChange): string {
	const rules = Array.isArray(roller?.rules) ? roller.rules : [];
	const parent = (
		rules as { parentDocument?: { uuid?: string | null; name?: string | null } | null }[]
	).find((rule) => rule?.parentDocument?.uuid === change.itemUuid)?.parentDocument;
	return (parent?.name ?? '').trim() || change.label;
}

/**
 * The Assess result, read as a skill check card of that skill against the Assess
 * DC. A rule of the roller that makes a low result a natural 20 counts.
 */
export function assessOutcome(
	roll: AssessRoll,
	roller: AssessRoller,
	skillKey: string,
): AssessOutcome {
	const natural = naturalResultChangeOfRoll(roller, { kind: 'skillCheck', key: skillKey }, roll);
	const isSuccess = succeedsWith(roll, natural ? [natural] : []);
	const decided = !!natural && isSuccess && !succeedsWith(roll, []);
	return {
		isSuccess,
		countsAsNat20Feature: decided && natural ? featureNameOf(roller, natural) : null,
	};
}

/** Whether an Assess roll succeeds. */
export function assessSucceeds(roll: AssessRoll, roller: AssessRoller, skillKey: string): boolean {
	return assessOutcome(roll, roller, skillKey).isSuccess;
}
