/** An actor whose roll data a formula reads. */
export interface FormulaActor {
	name?: string | null;
	isOwner?: boolean;
	getRollData?: () => object;
}

/** What wrote the formula: a rule of an item, or the item itself. */
export interface FormulaOwner {
	item?: { name?: string | null; isOwner?: boolean } | null;
	/** The rule's label or type. Empty for a formula of the item itself. */
	rule?: string;
}

/** A rule as a formula owner reads it. */
export interface FormulaRule {
	item?: FormulaOwner['item'];
	label?: string;
	type?: string;
}

export interface FormulaCheckOptions {
	/** Values the caller adds to the roll data for this formula only, such as `@spent`. */
	extraRollData?: Record<string, unknown>;
	/** The actor's roll data, when the caller already has it. */
	rollData?: object;
}
