export interface RollSummaryOptions {
	rollOptions?: {
		primaryDieValue?: string | number;
		primaryDieModifier?: string | number;
		primaryDieBaseResult?: number;
		[key: string]: unknown;
	};
	roll?: { terms?: { faces?: number }[] } | null;
	[key: string]: unknown;
}

export interface RollSummaryProps {
	label: string;
	subheading?: string | null;
	tooltip?: string | null;
	total: number;
	options?: RollSummaryOptions;
	showRollDetails?: boolean;
}
