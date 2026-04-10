export interface SelectionIndicatorProps {
	selected: boolean;
	onclick: (e: MouseEvent) => void;
	tooltip: string;
	ariaLabel: string;
	disabled?: boolean;
}
