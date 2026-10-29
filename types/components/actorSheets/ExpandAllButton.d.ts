export interface ExpandAllButtonProps {
	/** true when every row is open: the button then says Collapse all */
	allOpen?: boolean;
	/** icon only (phone header) */
	compact?: boolean;
	/** md = 28 px (character list tabs), sm = 26 px (NPC sheet header) */
	size?: 'md' | 'sm';
	/** the tooltip; default: the words of the button */
	tooltip?: string;
	onclick?: () => void;
}
