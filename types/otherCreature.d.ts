/** The creature on the other side of a roll, as a rule tests it. */
export interface OtherCreature {
	uuid?: string;
	getTargetDomain?(): Set<string>;
}
