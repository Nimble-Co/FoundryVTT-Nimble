import type { AttackOutcomeView } from '../incomingReactions/incomingReactionEntry.js';

/** The outcome fields that decide whether when-crit abilities fire. */
type CritTriggerOutcome = AttackOutcomeView & {
	/** A reroll discarded a crit and its rule keeps the crit's triggers */
	discardedCritTriggers?: boolean;
};

/**
 * Whether an attack fires when-crit abilities: it is a crit, or a reroll
 * discarded a crit and its rule says the discarded crit still triggers them.
 * Damage and effects follow the roll that stands; only triggers read this.
 */
export function firesCritTriggers(outcome: CritTriggerOutcome): boolean {
	return outcome.isCritical === true || outcome.discardedCritTriggers === true;
}

/** The outcome as triggers read it: a discarded crit that still triggers counts as a crit. */
export function critTriggerOutcome(outcome: CritTriggerOutcome): {
	isCritical: boolean;
	isMiss: boolean;
} {
	if (firesCritTriggers(outcome)) return { isCritical: true, isMiss: false };
	return { isCritical: false, isMiss: outcome.isMiss === true };
}
