interface OutCreature {
	statuses?: Set<string>;
}

/** A creature out of the fight: dead, or defeated in the combat. */
export function isOut(actor: OutCreature, defeated: boolean | undefined): boolean {
	return !!defeated || !!actor.statuses?.has('dead');
}
