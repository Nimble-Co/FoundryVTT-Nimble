export interface EditSwitchProps {
	editing: boolean;
	label: string;
	/** the tooltip out of edit mode */
	startHint: string;
	/** the tooltip in edit mode */
	stopHint: string;
	/** a pen icon, for the narrow header */
	compact?: boolean;
	/** a row with a pen, the label and the track, under the NPC rail tabs */
	menu?: boolean;
	onclick: () => void;
}
