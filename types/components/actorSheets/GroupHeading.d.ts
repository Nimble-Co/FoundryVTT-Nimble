import type { Snippet } from 'svelte';

export interface GroupHeadingProps {
	label: string;
	/** a short note after the label; an empty string keeps its place */
	note?: string;
	/** highlight (default) or muted */
	noteTone?: 'highlight' | 'muted';
	/** the group applies now: the label and the note in the highlight colour */
	now?: boolean;
	/** no space above, for the first heading of a tab */
	flush?: boolean;
	/** the label colour of the NPC Bloodied and Last Stand groups */
	tone?: 'bloodied' | 'lastStand';
	/** under: a line under the heading (default); none: no line */
	line?: 'under' | 'none';
	/** NPC column label: no line */
	plain?: boolean;
	/** over blocks, not rows (NPC Effects and Notes): 4 px above, 6 px below */
	blocks?: boolean;
	/** edit mode over rows: 8 px below */
	editing?: boolean;
	/** the space between the buttons at the end: sm 4 px (default), md 8 px (configure buttons in edit mode) */
	buttonGap?: 'sm' | 'md';
	/** buttons at the end of the line */
	children?: Snippet;
}
