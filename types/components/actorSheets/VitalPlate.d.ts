export interface VitalPlateProps {
	/** default "HP" */
	label?: string;
	value: number;
	/** leave it out for Temp HP */
	max?: number;
	onchange?: (value: number) => void;
	/** a vital state in words: Bloodied, Dying */
	state?: string;
	/** the state is Dying: block plates also turn the frame to the vital colour */
	dying?: boolean;
	/** Temp HP style: parchment label, centred number */
	temp?: boolean;
	/** badge = NPC rail (default), block = character rail */
	variant?: 'badge' | 'block';
	/** block: the smaller plate of the phone header */
	compact?: boolean;
	/** block: an icon after the label */
	icon?: string;
	tooltip?: string;
	/** edit mode: the number ignores the pointer */
	rest?: boolean;
	/** the maximum is a number that you type (the NPC sheet in edit mode) */
	onmaxchange?: (value: number) => void;
}
