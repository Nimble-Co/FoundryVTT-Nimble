interface RollSummaryOptions {
	rollOptions?: {
		primaryDieValue?: string | number;
		primaryDieModifier?: string | number;
		[key: string]: unknown;
	};
	[key: string]: unknown;
}

export interface RollSummaryProps {
	label: string;
	subheading?: string | null;
	tooltip?: string | null;
	total: number;
	options?: RollSummaryOptions;
	showRollDetails?: boolean;
	type?: string;
}
