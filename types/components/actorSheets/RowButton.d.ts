export interface RowButtonProps {
	kind?: 'expand' | 'edit' | 'spacer';
	open?: boolean;
	/** the name of the thing, for the label: "Configure {name}" */
	name?: string;
	/** md = character row, sm = NPC card */
	size?: 'md' | 'sm';
	/** 40 x 44 px targets for a phone */
	touch?: boolean;
	/** id of the text that the arrow opens */
	controls?: string;
	onclick?: () => void;
}
