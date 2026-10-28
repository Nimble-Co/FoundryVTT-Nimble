/** The kind of a pool. Each kind has its own colour token; `count` uses the class resource colour. */
export type PoolKind = 'mana' | 'dice' | 'charges' | 'uses' | 'count';

export interface RowUses {
	left: number;
	max: number;
	/** when they come back: turn, Safe Rest, encounter */
	per?: string;
	/** uses that one use costs; fewer left = out. Default 1 */
	need?: number;
}

export interface RowPool {
	kind: PoolKind;
	/** Font Awesome class */
	icon: string;
	amount: string | number;
	/** too few in the pool, or the pool is idle: the cost shows muted */
	muted?: boolean;
}

export interface RowCostProps {
	/** a short fact, for example "x2" or "2d6+3" */
	text?: string;
	uses?: RowUses[];
	pool?: RowPool;
	free?: boolean;
	/** NPC range tag, for example "Range 8" */
	range?: string;
	/** number of actions that a use costs */
	actions?: number;
	/** how many of those actions are spent this turn */
	actionsSpent?: number;
	/** tighter spacing and smaller uses, for the NPC card */
	compact?: boolean;
	/** the colour of uses that are out: vital (default), muted, or ink (no change, NPC card) */
	outTone?: 'vital' | 'muted' | 'ink';
	/** the cost is not inside a button: the uses and the actions get a tooltip */
	hints?: boolean;
}

/** A string, or [text, 'b'] for bold, or [text, 'die'] for a random roll */
export type SequencePart = string | [string, 'b' | 'die'];

export interface SheetTab {
	id: string;
	label: string;
	icon: string;
	/** count badge: leave it out or 0 for none */
	badge?: number;
	badgeTitle?: string;
}

export interface ViewOption {
	value: string;
	label: string;
}
