export interface ResourceBarProps {
	current: number;
	max: number;
	label: string;
	/** How many of `current` are temporary uses, drawn as a lighter part of the bar. */
	temporary?: number;
	updateCurrent: (value: number) => void;
}
