export interface SurgeDie {
	faces: number;
	value: number;
	/** The value before the die rolled again. */
	was?: number;
}

/** The surge on an Initiative card. */
export interface CardSurge {
	feature: string;
	flat: number;
	dice: SurgeDie[];
	/** The feature that lets a 1 roll again; empty with none. */
	rerollFeature: string;
	manaGiven: boolean;
	combatId: string;
}
