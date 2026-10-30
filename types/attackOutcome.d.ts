/** A crit without the max: on any face, or on any face that is not a miss. */
export type ForcedCritKind = 'always' | 'onHit';

/** The names of the features that changed how an attack roll is read, by what they changed. */
export interface AttackOutcomeSources {
	cannotMiss: string[];
	critRange: string[];
	forcedCrit: string[];
	anyDieCrits: string[];
}
