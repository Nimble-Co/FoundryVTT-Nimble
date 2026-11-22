/** One part a feature added to a damage roll, so the card can tell where the damage came from. */
export interface DamagePart {
	/** The plain name of the feature, as the card shows it. */
	label: string;
	/** The document that added the part, for a link. Empty when not known. */
	itemUuid: string;
	/** A flat amount added to the roll. */
	amount?: number;
	/** Dice added to the roll, as a formula with no flavor. */
	formula?: string;
}

/** The feature that made a damage box of its own. */
export interface DamageNodeSource {
	label: string;
	/** The document of the feature, for a link. Empty when not known. */
	uuid: string;
}
