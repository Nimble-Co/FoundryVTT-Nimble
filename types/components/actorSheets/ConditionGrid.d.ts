export interface ConditionGridOption {
	id: string;
	name: string;
	img: string;
	/** the condition is on the actor */
	on: boolean;
}

export interface ConditionGridProps<T extends ConditionGridOption> {
	label: string;
	options: T[];
	onpick: (option: T) => void;
}
