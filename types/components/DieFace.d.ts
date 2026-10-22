import type { DieOutcome } from '#utils/incomingReactionEntry.ts';

export interface DieFaceProps {
	/** Die size. Sizes without a Foundry die icon (anything but 4, 6, 8, 10, 12, 20) draw a d6. */
	faces: number;
	value: number;
	outcome?: DieOutcome;
	/** A result that no longer counts, e.g. the old die of a reroll. */
	discarded?: boolean;
}
