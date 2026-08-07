export interface SelectionIndicatorProps {
	selected: boolean;
	onclick: (e: MouseEvent) => void;
	/** Key handler for groups that navigate between indicators, e.g. arrow keys in a radiogroup. */
	onkeydown?: (e: KeyboardEvent) => void;
	tooltip: string;
	ariaLabel: string;
	disabled?: boolean;
	/**
	 * ARIA role override. Defaults to the button's own role; pass `'radio'` when the indicator
	 * is one of several mutually exclusive choices inside a `radiogroup`.
	 */
	role?: 'radio' | 'checkbox';
	/**
	 * Checked state for `role="radio"` / `role="checkbox"`. Ignored without a `role`, and defaulted
	 * to `false` rather than omitted, since a radio with no `aria-checked` is invalid.
	 */
	ariaChecked?: boolean;
	/**
	 * Tab-order override. Pass `-1`/`0` to give a group of indicators a single tab stop, as a
	 * `radiogroup` requires.
	 */
	tabIndex?: number;
}
