/** A crit without the max: on any face, or on any face that is not a miss. */
export type ForcedCritKind = 'always' | 'onHit';

/** The names of the features that changed how an attack roll is read, by what they changed. */
export interface AttackOutcomeSources {
	cannotMiss: string[];
	critRange: string[];
	forcedCrit: string[];
	anyDieCrits: string[];
}

/** A tag at the roll that tells why the attack result is not what the die face shows. */
export interface AttackOutcomeTag {
	kind: 'crit' | 'cannotMiss' | 'noOutcome';
	label: string;
	tooltip: string;
}

/** What a Multi-target Attack gave up, as it was when rolled. */
export interface MultiTargetDetail {
	targets: number;
	couldCrit: boolean;
	couldMiss: boolean;
}
