import type { IncomingReactionEntry } from '#utils/incomingReactions/incomingReactionEntry.ts';

/** What the tick of the roll window can do for this attack. */
export interface DualWieldOffer {
	/** The other weapon. Null with the same formula: the tick is advantage. */
	other: { uuid: string; name: string } | null;
	/** The use of this round was spent. */
	used: boolean;
}

/** The choice of the roll window. */
export interface DualWieldChoice {
	otherItemUuid: string | null;
	/** With advantage on a different weapon: the weapon with the extra die. */
	extraDieOn: 'activated' | 'other';
}

/** One weapon of a dual wield attack, as a reroll needs it. */
export interface DualWieldWeapon {
	formula: string;
	options: Record<string, unknown>;
	itemUuid: string;
	label: string;
	damageType: string;
}

export type DualWieldWeaponSelf = Pick<DualWieldWeapon, 'itemUuid' | 'label' | 'damageType'>;

/** The keep between two weapons, and its entry, for the chat card. */
export interface DualWieldKeep {
	pendingKeep: Record<string, unknown>;
	entry: IncomingReactionEntry;
}
