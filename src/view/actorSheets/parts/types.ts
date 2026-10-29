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
