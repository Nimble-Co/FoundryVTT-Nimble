export interface InlineNumberProps {
	value: number;
	/** aria-label, for example "Current HP" */
	label: string;
	onchange?: (value: number) => void;
	align?: 'right' | 'center';
	/** a faint dotted line under the number, for edit mode */
	dotted?: boolean;
	width?: string;
	min?: number;
	max?: number;
	/** plain (default), label (rail meter label line), field (26 px, meter and phone strip), cost (row uses in edit mode) */
	variant?: 'plain' | 'label' | 'field' | 'cost';
	/** edit mode: the number ignores the pointer */
	rest?: boolean;
}
