export interface ResourceBarProps {
	current: number;
	max: number;
	/** The book gives no cap: show the count alone, with an empty bar. */
	hideMax?: boolean;
	label: string;
	/** How many of `current` are temporary uses, drawn as a lighter part of the bar. */
	temporary?: number;
	/** The features that gave the temporary uses, for the tooltip. */
	temporarySource?: string;
	updateCurrent: (value: number) => void;
}
