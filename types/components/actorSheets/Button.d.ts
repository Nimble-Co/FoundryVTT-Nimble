export interface ButtonProps {
	variant?: 'secondary' | 'primary';
	/** Font Awesome class before the label */
	icon?: string;
	label?: string;
	size?: 'md' | 'sm';
	iconOnly?: boolean;
	ariaLabel?: string;
	/** a toggle: true or false; leave it out for a plain button */
	pressed?: boolean;
	tooltip?: string;
	/** the button stays visible but does nothing */
	disabled?: boolean;
	/** the window gives this button the focus when it opens */
	autofocus?: boolean;
	onclick?: () => void;
}
