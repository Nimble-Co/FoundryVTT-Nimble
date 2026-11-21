import type { ResourceCost } from './resourceCost.d.ts';

/** How an option changes the action cost of a use: add `delta`; a cut stops at `minimum`. */
export interface ActionCostChange {
	delta: number;
	minimum: number;
}

/** One Spell or Attack Option a creature can turn on in the dialog of an item. */
export interface UseOption {
	/** The key of the option's rule on the creature. */
	key: string;
	/** The name of the item that owns the option. */
	name: string;
	/** What the option costs, with its formulas read. */
	cost: ResourceCost;
	/** The Charge Pool whose uses the option spends, or '' for none. */
	poolIdentifier: string;
	actionCostChange: ActionCostChange | null;
}

/** The options that share one Charge Pool, or one option with none: one dropdown. */
export interface UseOptionGroup {
	key: string;
	/** The pool's label, or the option's name. */
	label: string;
	/** The pool has no use left. */
	used: boolean;
	options: UseOption[];
}

/** An option the player turned on, and the amount chosen for a variable cost. */
export interface ChosenUseOption {
	key: string;
	amount?: number;
}
