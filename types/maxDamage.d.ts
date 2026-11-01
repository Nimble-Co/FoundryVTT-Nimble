/** A Max Damage tick in a roll window. */
export interface MaxDamageOffer {
	/** Finds the rule again when the roll is made. */
	key: string;
	label: string;
	use: 'damage' | 'healing';
	/** The player can give temp HP in place of healing. */
	tempHpChoice: boolean;
	/** Charges one use takes. 0 is free. */
	chargeCost: number;
	canPay: boolean;
}

/** What the player picked in a roll window. */
export interface MaxDamageChoice {
	key: string;
	tempHp: boolean;
}
