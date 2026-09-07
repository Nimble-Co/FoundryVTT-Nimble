interface ResourceBarBaseProps {
	current: number;
	max: number;
	updateCurrent: (value: number) => void;
}

interface ResourceBarWithFixedMax extends ResourceBarBaseProps {
	disableMaxEdit: true;
	updateMax?: (value: number) => void;
}

interface ResourceBarWithEditableMax extends ResourceBarBaseProps {
	disableMaxEdit?: false;
	updateMax: (value: number) => void;
}

export type ResourceBarProps = ResourceBarWithFixedMax | ResourceBarWithEditableMax;
