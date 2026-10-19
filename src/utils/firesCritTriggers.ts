/** The outcome fields that decide whether when-crit abilities fire. */
interface CritTriggerOutcome {
	isCritical?: boolean;
	/** A reroll discarded a crit and its rule keeps the crit's triggers */
	discardedCritTriggers?: boolean;
}

/**
 * Whether an attack fires when-crit abilities: it is a crit, or a reroll
 * discarded a crit and its rule says the discarded crit still triggers them.
 * Damage and effects follow the roll that stands; only triggers read this.
 */
export function firesCritTriggers(outcome: CritTriggerOutcome): boolean {
	return outcome.isCritical === true || outcome.discardedCritTriggers === true;
}
