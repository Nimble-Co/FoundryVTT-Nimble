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

/** Structural view of a `maxDamage` rule, so this module needs no rule import. */
export interface MaxDamageRuleLike {
	type?: string;
	id?: string;
	label?: string;
	use?: 'damage' | 'healing' | 'minionAttack';
	item?: { name?: string; uuid?: string } | null;
	givesCrit?: boolean;
	tempHpChoice?: boolean;
	minionDies?: boolean;
	chargePoolIdentifier?: string;
	chargeCost?: number;
	canPay?: boolean;
	covers?(item: unknown): boolean;
}
