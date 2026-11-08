/** The creature on the other side of a roll, as a rule tests it. */
export interface OtherCreature {
	uuid?: string | null;
	getTargetDomain?(): Set<string>;
}
