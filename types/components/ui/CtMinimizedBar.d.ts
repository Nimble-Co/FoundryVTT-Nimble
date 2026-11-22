import type { Snippet } from 'svelte';

import type {
	MinimizedBarControls,
	MinimizedTrackerSummary,
} from '#view/ui/ctTopTracker/minimized.utils.ts';

export type CtIconButtonSnippet = Snippet<
	[
		labelKey: string,
		iconClass: string,
		tooltipDirection: 'DOWN' | 'LEFT' | 'RIGHT',
		onclick: (event: MouseEvent) => void,
		ready: boolean,
	]
>;

export interface CtMinimizedBarProps {
	summary: MinimizedTrackerSummary;
	controls: MinimizedBarControls;
	endTurnReady: boolean;
	iconButton: CtIconButtonSnippet;
	onControl: (event: MouseEvent, action: string) => void;
	onEndTurn: (event: MouseEvent) => void;
	onExpand: () => void;
	onPortraitError: (event: Event) => void;
}
