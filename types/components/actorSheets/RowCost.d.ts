import type { RowPool, RowUses } from '#view/actorSheets/parts/types.ts';

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
}
