import type { NimbleCharacter } from '#documents/actor/character.js';
import type { OptionSwapChange, ResolvedOptionSwapOffer } from '#types/optionSwap.d.ts';

export interface OptionSwapSectionProps {
	/** The character whose picks and skill points the section edits. */
	document: NimbleCharacter;
	/**
	 * What this rest offers, or `null` when the character has no feature that offers a swap.
	 * A `null` offer renders nothing at all.
	 */
	offer: ResolvedOptionSwapOffer | null;
	/**
	 * Called once the held picks are seeded and after every change, so the host dialog can hold
	 * the result and pass it on when it submits.
	 */
	onChange: (change: OptionSwapChange) => void;
	/**
	 * Called whenever the section starts or stops offering a change the rest would act on, so
	 * the host dialog can say so on its confirm button.
	 */
	onPending?: (isPending: boolean) => void;
	/**
	 * Called after the section opens or closes, and after a pool's alternatives unfold or fold,
	 * so the host can fit its window to the new height.
	 */
	onToggle?: (isExpanded: boolean) => void;
}
