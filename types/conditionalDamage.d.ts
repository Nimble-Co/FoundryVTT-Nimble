/** Typed damage rolled as a damage effect of its own. */
export interface ConditionalDamage {
	formula: string;
	damageType: string;
	label: string;
	/** The document of the rule that offers it. */
	itemUuid?: string;
	fromItemIdentifier?: string;
	/** Flat damage that armor treats as a damage modifier. */
	modifierOnly?: boolean;
}
