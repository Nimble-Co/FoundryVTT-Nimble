import type { NimbleCharacter } from '#documents/actor/character.js';
import type { ResolvedOptionSwapOffer } from '#types/optionSwap.d.ts';

export interface OptionSwapSectionProps {
	/** The character whose picks and skill points the section edits. */
	document: NimbleCharacter;
	/**
	 * What this rest offers, or `null` when the character has no feature that offers a swap.
	 * A `null` offer renders nothing at all.
	 */
	offer: ResolvedOptionSwapOffer | null;
	/**
	 * Pool key to the uuids the player wants to hold from that pool. Bindable, and written
	 * only by the section: the host dialog holds it and passes it on when it submits.
	 */
	selections: Map<string, string[]>;
	/**
	 * Skill key to its new point total, for the skills a move changed. Bindable, written only
	 * by the section, and empty until a move is balanced — an unplaced point is not a move.
	 */
	skillPoints: Map<string, number>;
}
