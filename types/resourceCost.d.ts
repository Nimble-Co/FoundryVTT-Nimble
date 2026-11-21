import type { OverdraftConsequence } from './spellCost.d.ts';

/** What a cost takes from the creature. Mana, temp HP: spent. HP, Wounds: sacrificed. */
export type ResourceCostKind = 'mana' | 'hp' | 'tempHp' | 'wounds';

/** A number, a formula such as `@abilities.will.mod`, or a roll such as `1d4`. */
export type ResourceCostAmount = number | string;

/**
 * A fixed cost takes its amount; a variable one lets the player choose between min and max,
 * which are formulas.
 */
export type ResourceCostSpend = { mode: 'fixed' } | { mode: 'variable'; min: string; max: string };

/** What a use that needs more than the creature has does. */
export type UsingBeyondWhatYouHave = 'notAllowed' | 'allowed' | Exclude<OverdraftConsequence, ''>;

/** One cost in one resource, as the cost ledger checks and spends it. */
export interface ResourceCost {
	kind: ResourceCostKind;
	amount: ResourceCostAmount;
	spend: ResourceCostSpend;
	beyond: UsingBeyondWhatYouHave;
	/** The name of what the cost is for, for notices and the card. */
	source?: string;
	/** The rule the cost comes from, which keys the amount the player chose. */
	id?: string;
	/** The roll a rolled amount came from, once it is rolled. */
	roll?: string;
}

/** Asks the player to confirm costs that need more than the creature has. True to go on. */
export type ConfirmBeyond = (costs: ResourceCost[]) => Promise<boolean>;

/** What one use spent or sacrificed of each kind, as the item's formulas read it in `@cost`. */
export type ResourceCostRollData = Record<ResourceCostKind, number>;

/** One cost of a use, as its chat card keeps it. */
export interface CardResourceCost {
	kind: ResourceCostKind;
	amount: number;
	/** The name of what the cost is for. */
	source: string;
	/** The roll of a rolled amount, such as `1d4`. */
	roll?: string;
}
