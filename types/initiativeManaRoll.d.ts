export interface InitiativeManaDie {
	faces: number;
	value: number;
	/** The value before the die rolled again. */
	was?: number;
}

/** The initiativeMana on an Initiative card. */
export interface CardInitiativeMana {
	feature: string;
	flat: number;
	dice: InitiativeManaDie[];
	/** The feature that lets a 1 roll again; empty with none. */
	rerollFeature: string;
	manaGiven: boolean;
	combatId: string;
}
