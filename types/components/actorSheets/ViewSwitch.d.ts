import type { ViewOption } from '#view/actorSheets/parts/types.ts';

export interface ViewSwitchProps {
	options: ViewOption[];
	/** the value of the option that is on */
	value?: string;
	/** what the switch changes, for a screen reader: "Group the spells" */
	label: string;
	onchange?: (value: string) => void;
}
