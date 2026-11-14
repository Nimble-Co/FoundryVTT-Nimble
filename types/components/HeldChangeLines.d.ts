export interface HeldChangeLinesProps {
	lines: Array<{ key?: string; text: string; source: string; rollMode?: number }>;
	/** Feature Effects off: each line is a tick box, and only ticked changes apply. */
	choosing?: boolean;
	/** The keys of the ticked lines. */
	chosen?: string[];
}
