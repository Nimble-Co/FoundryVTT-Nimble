import type { RowCostProps } from './RowCost.d.ts';
import type { Snippet } from 'svelte';

export interface RowProps {
	name: string;
	/** the document art */
	img?: string;
	/** Font Awesome class, when there is no image */
	icon?: string;
	/** a short tag after the name: ACTIVE, USED */
	tag?: string;
	tagOn?: boolean;
	/** an item that you can equip: the tag is a toggle that equips it or puts it away */
	onequip?: () => void;
	/** with onequip: the item is equipped */
	equipped?: boolean;
	/** one line under the name */
	summary?: string;
	/** act = you just used it, warn = a risk (past the limit) */
	summaryTone?: 'act' | 'warn';
	cost?: RowCostProps;
	/** the full text, shown when the row is open */
	description?: string;
	/** facts shown when the row is open: [label, value] */
	facts?: [string, string][];
	/** active = an effect of yours is on; just = you just used it; used and out = no uses left */
	state?: 'active' | 'just' | 'used' | 'out';
	/** the row is open; bind it, or let the row keep its own */
	open?: boolean;
	/** the arrow was clicked; the parent keeps `open` (for Expand all). Leave it out and the row keeps its own */
	ontoggle?: () => void;
	/** a click on the row: use the thing. Leave it out for a row that you only read */
	onuse?: () => void;
	/** aria-label of the control that uses the thing; default "Use {name}" */
	useLabel?: string;
	/** aria-expanded of the control that uses the thing, for a thing that opens its choices */
	useExpanded?: boolean;
	/** the thing cannot be used now; default: state out */
	disabled?: boolean;
	/** the pen: open the window of the thing */
	onedit?: () => void;
	/** false = no window: an empty place in place of the pen */
	hasWindow?: boolean;
	/** edit mode: the numbers that you type, in place of the cost */
	fields?: Snippet;
	/** edit mode: a row with no window, faded */
	dim?: boolean;
	/** under the row: its choices, or a question */
	children?: Snippet;
	/** 52 px rows and 40 x 44 px buttons for a phone */
	touch?: boolean;
	id?: string;
}
