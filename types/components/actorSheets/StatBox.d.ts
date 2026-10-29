export interface StatBoxProps {
	icon?: string;
	label: string;
	value: string | number;
	variant?: 'box' | 'inline';
	/** the cause of a change, in words */
	warn?: string;
	/** a bonus from an active effect, for example "+2" */
	note?: string;
	tooltip?: string;
}
