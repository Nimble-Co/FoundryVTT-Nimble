import type { SheetTab } from '#view/actorSheets/parts/types.ts';

export interface SheetTabsProps {
	tabs: SheetTab[];
	/** the id of the selected tab */
	value?: string;
	onchange?: (id: string) => void;
	layout?: 'top' | 'rail' | 'strip';
	/** top: the layout for the width of a slot */
	fit?: 'inline' | 'stacked' | 'icon';
	/** default "Sheet tabs" */
	label?: string;
}
