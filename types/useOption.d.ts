import type { ResourceCost } from './resourceCost.d.ts';

/** How an option changes a cost of a use: add `delta`; a cut stops at `minimum`. */
export interface CostChange {
	delta: number;
	minimum: number;
}

export type ActionCostChange = CostChange;

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
	/** Range added for each of the amount the option spends. */
	rangePerMana: number;
	/** A line on the card of the cast. `{amount}` is the amount the option spent. */
	cardNote: string;
	/** The damage types the player picks one of. The spell deals the picked type. */
	damageTypes: string[];
	/** How the option changes the mana cost of the spell. */
	manaCostChange: CostChange | null;
	/** After the cast, a free copy of the spell posts at the same tier. */
	freeCopy: boolean;
	/** The option's cost takes the place of the spell's own cost: a button under "Spend". */
	replacesSpellCost: boolean;
	/** The mana the spell costs at its own tier, with no upcast, or null for no change. */
	manaSet: number | null;
	/** The effect the caster gains after a cast with the option. */
	effect: UseOptionEffect | null;
	/** The option's Charge Pool has no use left. */
	used: boolean;
}

/** An effect of the item that owns an option. */
export interface UseOptionEffect {
	itemUuid: string;
	effectId: string;
}

/** The options that share one Charge Pool, or one option with none: one dropdown. */
export interface UseOptionGroup {
	key: string;
	/** The pool's label, or the option's name. */
	label: string;
	/** The pool has no use left. */
	used: boolean;
	/** The pool gets its uses back at the start of a turn. */
	refillsEachTurn?: boolean;
	/** The options of the group take the place of the spell's cost: buttons under "Spend". */
	spend: boolean;
	options: UseOption[];
}

/** An option the player turned on, and the amount chosen for a variable cost. */
export interface ChosenUseOption {
	key: string;
	amount?: number;
	/** The damage type the player picked. */
	pick?: string;
}
