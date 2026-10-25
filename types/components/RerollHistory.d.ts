import type { PendingKeep } from '#utils/incomingReactionEntry.ts';
import type { rerollHistoryLines } from '../../src/view/chat/components/rerollHistoryLines.ts';
import type { HeldIncomingReactions } from './IncomingReactionPrompts.d.ts';

type RerollHistoryLine = ReturnType<typeof rerollHistoryLines>[number];

export interface RerollHistoryProps {
	/** Lines for used legacy `forceReroll` entries, which wrote no reroll record. */
	legacyLines: { id: string; text: string }[];
	lines: RerollHistoryLine[];
	/** A reroll that waits for its chooser to keep the old or the new roll. */
	pendingKeep: PendingKeep | null;
	pendingLine: RerollHistoryLine | null;
	held: HeldIncomingReactions;
}
