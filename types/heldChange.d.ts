/** What a Held Change does to the roll that uses it. */
export type HeldChangeKind =
	| 'advantage'
	| 'primaryDie'
	| 'wholeAmount'
	| 'ignoreDisadvantage'
	| 'mustAttackOther'
	| 'vulnerableOnce'
	| 'maximize';

/** The time that ends a Held Change that code makes. It becomes a Lasts Until moment. */
export type HeldChangeEnd = 'turn' | 'round' | 'combat';

/** What code gives to make a Held Change: an effect with a Held Roll rule. */
export interface HeldChangeData {
	kind: HeldChangeKind;
	/** Steps of advantage, the number on the Primary Die, or the whole amount of the attack. */
	value: number;
	label: string;
	appliesTo: 'holderAttacks' | 'attacksOnHolder';
	spentBy: 'oneRoll' | 'everyRoll';
	ends: HeldChangeEnd;
	/** The uuid of the creature or item that made it. */
	origin?: string | null;
	/** The damage type of a one-use vulnerability. */
	damageType?: string;
	/** The card that made it, so a new roll on that card can take it back. */
	sourceMessageId?: string;
}

/** A Held Change as it is on a creature: one Held Roll rule of an effect. */
export interface HeldChange {
	kind: HeldChangeKind;
	value: number;
	label: string;
	sourceName: string;
	appliesTo: 'holderAttacks' | 'attacksOnHolder';
	spentBy: 'oneRoll' | 'everyRoll';
	meleeOnly: boolean;
	/** Only attacks by this creature use it; empty when that creature is lost. Null: any attacker. */
	onlyFromUuid: string | null;
	damageType?: string;
	sourceMessageId?: string;
	effectId: string;
	holderUuid: string;
}
