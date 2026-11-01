import type { HeldIncomingReactions } from './IncomingReactionPrompts.d.ts';

/** One history line of Change a Result. Repeats of one add are one line. */
export interface ResultChangeLine {
	/** The line id of its clicks, which Remove asks for. */
	id: string;
	/** What it did: "Added +6 STR, Gained 2 Wounds". */
	verb: string;
	/** "with Mighty Soul". */
	withFeature: string;
	/** The line as a sentence, for its Remove button. */
	sentence: string;
	/** Who used it, when not the one who rolled. */
	detail: string | null;
	/** A new roll took it off: the line stays, with no Remove. */
	retired: boolean;
	canRemove: boolean;
}

export interface ResultChangeLinesProps {
	/** The sum box above the lines, such as "7 + 3 + 3 = 13". Null for no box. */
	sum?: string | null;
	lines: readonly ResultChangeLine[];
	held: HeldIncomingReactions;
	onremove: (line: ResultChangeLine) => Promise<void>;
}
