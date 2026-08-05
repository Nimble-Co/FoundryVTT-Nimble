export interface DocumentPickerProps {
	value: string;
	onChange: (next: string) => void;
	disabled?: boolean;
	/** Restricts drop acceptance — e.g. `['Item']` or `['Item.spell']`. */
	documentTypes?: string[];
	placeholder?: string;
}
