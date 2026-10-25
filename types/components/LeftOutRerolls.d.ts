import type { IncomingReactionEntry } from '#utils/incomingReactionEntry.ts';

export interface LeftOutRerollsProps {
	/** The ally rerolls the scan left out of this card. */
	entries: IncomingReactionEntry[];
}
