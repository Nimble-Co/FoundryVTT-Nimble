export interface EditZoneProps {
	/** the words on the tag: Hit Points, Movement, Skills */
	short: string;
	/** the name of the window: Configure Hit Points */
	label: string;
	/** the tag sits in the middle of the line, not over the top edge */
	inline?: boolean;
	/** a row of a list: no outline space above and below */
	row?: boolean;
	onclick?: () => void;
}
