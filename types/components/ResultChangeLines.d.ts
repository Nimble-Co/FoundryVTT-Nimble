import type { ResultChangeLine } from '../../src/view/chat/components/resultChangeLines.ts';
import type { HeldIncomingReactions } from './IncomingReactionPrompts.d.ts';

export interface ResultChangeLinesProps {
	/** The sum box above the lines, such as "7 + 3 + 3 = 13". Null for no box. */
	sum?: string | null;
	lines: readonly ResultChangeLine[];
	held: HeldIncomingReactions;
	onremove: (line: ResultChangeLine) => Promise<void>;
}
