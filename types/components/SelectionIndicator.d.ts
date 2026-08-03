export interface SelectionIndicatorProps {
	selected: boolean;
	onclick: (e: MouseEvent) => void;
	tooltip: string;
	ariaLabel: string;
	disabled?: boolean;
	/**
	 * ARIA role override. Defaults to the button's own role; pass `'radio'` when the indicator
	 * is one of several mutually exclusive choices inside a `radiogroup`.
	 */
	role?: 'radio' | 'checkbox';
	/** Checked state for `role="radio"` / `role="checkbox"`. Ignored without a `role`. */
	ariaChecked?: boolean;
}
