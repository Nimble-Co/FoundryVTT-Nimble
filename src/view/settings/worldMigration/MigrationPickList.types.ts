import type { Snippet } from 'svelte';

export interface MigrationPickListProps<Item> {
	items: Item[];
	selectedIndex: number;
	/** The accessible name of the list. */
	label: string;
	itemKey: (item: Item) => string;
	/** The accessible name of one pick, when its text alone does not say enough. */
	itemLabel?: (item: Item) => string;
	onSelect: (index: number) => void;
	/** The cells of one pick: an icon, a name and a trailing mark. */
	pick: Snippet<[Item]>;
}
