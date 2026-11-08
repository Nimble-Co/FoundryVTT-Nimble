export interface ItemNavigationTab {
	name: string;
	tooltip: string;
	icon: string;
	display?: boolean;
}

export interface ItemTabsProps {
	currentTab: ItemNavigationTab;
	navigation: ItemNavigationTab[];
}
