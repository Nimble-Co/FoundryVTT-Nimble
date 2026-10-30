import type { DieChangeMode } from '#utils/incomingReactions/incomingReactionEntry.ts';

/**
 * A change to one die: set it to a face, or add a number (which may be
 * negative) to it. A rule's change and the card's record of it hold 0 for a
 * set, as the face is picked when the rule is used.
 */
export interface DieChange {
	mode: DieChangeMode;
	value: number;
	/** A set only: a Primary Die bonus goes on the set value. Absent: the set value is the final face. */
	addsBonus?: boolean;
}
