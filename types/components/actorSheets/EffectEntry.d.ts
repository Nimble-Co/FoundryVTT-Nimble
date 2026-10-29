export interface EffectEntryProps {
	name: string;
	icon?: string;
	/** where it comes from, or what it is attached to */
	source?: string;
	duration?: string;
	text?: string;
	/** your own effect: it can end, and it gets the own colour */
	own?: boolean;
	/** the text is open */
	open?: boolean;
	/** the word for the end button and its question; default "End" */
	endLabel?: string;
	onend?: () => void;
}
