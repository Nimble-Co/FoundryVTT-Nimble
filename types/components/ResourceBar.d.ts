export interface ResourceBarProps {
	current: number;
	max: number;
	disableControls?: boolean;
	disableMaxEdit?: boolean;
	updateCurrent?: (value: number) => void;
	updateMax?: (value: number) => void;
}
