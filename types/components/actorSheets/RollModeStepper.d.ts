export interface RollModeStepperProps {
	/** positive = advantage, negative = disadvantage */
	value?: number;
	onchange?: (value: number) => void;
	min?: number;
	max?: number;
	/** the colour of a disadvantage: vital (default) or warn */
	disTone?: 'vital' | 'warn';
	/** fixed button widths */
	fixed?: boolean;
}
