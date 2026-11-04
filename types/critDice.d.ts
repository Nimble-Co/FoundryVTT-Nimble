/** Dice a crit adds as a line of their own, as the roll stores them. */
export interface CritDiceSpec {
	/** The rule, so its limit can follow the dice. */
	key: string;
	label: string;
	/** What other features call these dice. */
	role: string;
	/** With no `@` part left in it. */
	formula: string;
	/** The rule can add its dice once per turn. */
	oncePerTurn?: boolean;
}

/** The crit dice of one feature, for the card. */
export interface CritDiceLine {
	label: string;
	role: string;
	values: number[];
	total: number;
}

/** The options of a die term a crit added. */
export interface CritDiceOptions {
	flavor?: string;
	dieRole?: string;
	critDiceKey?: string;
}
