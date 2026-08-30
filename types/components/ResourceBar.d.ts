interface BaseProps {
	current: number;
	max: number;
	compact?: boolean;
	disableControls?: boolean;
	disableMaxEdit?: boolean;
	updateCurrent?: (value: number) => void;
	updateMax?: (value: number) => void;
}

interface WithoutControls extends BaseProps {
	disableControls: true;
}

interface WithControls extends BaseProps {
	disableControls?: false;
	updateCurrent: NonNullable<BaseProps['updateCurrent']>;
	updateMax?: BaseProps['updateMax'];
}

export type ResourceBarProps = WithControls | WithoutControls;
