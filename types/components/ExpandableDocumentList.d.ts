export interface ExpandableDocumentItem {
	uuid: string;
	name: string;
	img: string;
}

export interface ExpandableDocumentListProps {
	items: ExpandableDocumentItem[];
	selectedItem: ExpandableDocumentItem | null;
	selectTooltip: string;
	deselectTooltip: string;
	selectAriaLabel: (itemName: string) => string;
	deselectAriaLabel: (itemName: string) => string;
}
