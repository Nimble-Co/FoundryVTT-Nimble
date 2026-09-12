export interface ResourceBarProps {
	current: number;
	max: number;
	label: string;
	updateCurrent: (value: number) => void;
}
