import type { rerollHistoryLines } from '../../src/view/chat/components/rerollHistoryLines.ts';

type RerollHistoryLine = ReturnType<typeof rerollHistoryLines>[number];

export interface RerollHistoryProps {
	/** Lines for used legacy `forceReroll` entries, which wrote no reroll record. */
	legacyLines: { id: string; text: string }[];
	lines: RerollHistoryLine[];
}
