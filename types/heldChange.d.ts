/** What a Held Change does to the roll that uses it. */
export type HeldChangeKind =
	| 'advantage'
	| 'primaryDie'
	| 'wholeAmount'
	| 'ignoreDisadvantage'
	| 'mustAttackOther'
	| 'vulnerableOnce'
	| 'maximize'
	| 'extraDamage';

/** Which roll uses a Held Change: the holder's next attack, or the next attack against the holder. */
export type HeldAppliesTo = 'holderAttacks' | 'attacksOnHolder';

/** The attack that uses up a Held Change, as the Lasts Until sentence names it. */
export interface HeldUsedUp {
	by: HeldAppliesTo;
	/** Only a melee attack uses it. */
	melee: boolean;
	/** Only a ranged attack uses it. */
	ranged?: boolean;
	/** Only an attack by the creature that applied it uses it. */
	fromSource: boolean;
}

/** The time that ends a Held Change that code makes. It becomes a Lasts Until moment. */
export type HeldChangeEnd = 'turn' | 'round' | 'combat';

/** What code gives to make a Held Change: an effect with a Held Roll rule. */
export interface HeldChangeData {
	kind: HeldChangeKind;
	/** Steps of advantage, the number on the Primary Die, or the whole amount of the attack. */
	value: number;
	label: string;
	appliesTo: HeldAppliesTo;
	spentBy: 'oneRoll' | 'everyRoll';
	ends: HeldChangeEnd;
	/** The uuid of the creature or item that made it. */
	origin?: string | null;
	/** The damage type of a one-use vulnerability, or of the extra damage. */
	damageType?: string;
	/** The dice of the extra damage. */
	formula?: string;
	/** The card that made it, so a new roll on that card can take it back. */
	sourceMessageId?: string;
}

/** A Held Change as it is on a creature: one Held Roll rule of an effect. */
export interface HeldChange
	extends Pick<
		HeldChangeData,
		| 'kind'
		| 'value'
		| 'label'
		| 'appliesTo'
		| 'spentBy'
		| 'damageType'
		| 'formula'
		| 'sourceMessageId'
	> {
	sourceName: string;
	meleeOnly: boolean;
	/** Only a ranged attack uses it. An attack that is not known to be ranged does not. */
	rangedOnly?: boolean;
	/** Only attacks by this creature use it; empty when that creature is lost. Null: any attacker. */
	onlyFromUuid: string | null;
	effectId: string;
	holderUuid: string;
}

/** An area card: the change on a target that maximizes the roll against it. */
export type AreaMaximizeFor = (actor: object) => HeldChange | null;
