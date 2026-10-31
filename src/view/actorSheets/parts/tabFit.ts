import type { SheetTabsProps } from '#types/components/actorSheets/SheetTabs.d.ts';

export type TabFit = NonNullable<SheetTabsProps['fit']>;

/** How a top tab bar of `count` tabs fits `width` px: label beside the icon, under it, or no label. */
export function tabFit(width: number, count: number): TabFit {
	const slot = width / count;
	if (slot >= 78) return 'inline';
	return slot >= 42 ? 'stacked' : 'icon';
}
