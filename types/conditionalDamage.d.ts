/** Typed damage rolled as a damage effect of its own. */
export interface ConditionalDamage {
	formula: string;
	damageType: string;
	label: string;
	fromItemIdentifier?: string;
	/** Flat damage that armor treats as a damage modifier. */
	modifierOnly?: boolean;
}
