/** What a Held Change does to the roll that uses it. */
export type HeldChangeKind =
	| 'primaryDie'
	| 'wholeAmount'
	| 'ignoreDisadvantage'
	| 'mustAttackOther'
	| 'vulnerableOnce';

/** The time that ends a Held Change. */
export type HeldChangeEnd = 'turn' | 'round' | 'combat';

/** A change to a later roll that waits on a creature. */
export interface HeldChangeData {
	kind: HeldChangeKind;
	/** The number on the Primary Die, or the whole amount of the attack. */
	value: number;
	label: string;
	sourceName: string;
	appliesTo: 'holderAttacks' | 'attacksOnHolder';
	spentBy: 'oneRoll' | 'everyRoll';
	ends: HeldChangeEnd;
	/** The combat, round and turn it was made in. Empty outside combat. */
	combatId: string;
	round: number;
	turn: number;
	/** The damage type of a one-use vulnerability. */
	damageType?: string;
}

/** A Held Change as it is on a creature. */
export interface HeldChange extends HeldChangeData {
	effectId: string;
	holderUuid: string;
}
