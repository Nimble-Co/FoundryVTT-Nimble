export interface ItemEffectPickerProps {
	value: string;
	onChange: (next: string) => unknown;
	disabled?: boolean;
	document: unknown;
	/** The field label, the accessible name of the select. */
	label: string;
	/** who reads the Lasts Until line; default 'targets' */
	recipient?: 'self' | 'targets';
}
