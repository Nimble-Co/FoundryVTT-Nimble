import type { OverdraftConsequence } from './spellCost.d.ts';

/** What a cost takes from the creature. Mana, temp HP: spent. HP, Wounds: sacrificed. */
export type ResourceCostKind = 'mana' | 'hp' | 'tempHp' | 'wounds';

/** A number, a formula such as `@abilities.will.mod`, or a roll such as `1d4`. */
export type ResourceCostAmount = number | string;

/** A fixed cost takes its amount; a variable one lets the player choose between min and max. */
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
}

/** One cost of a use, as its chat card keeps it. */
export interface CardResourceCost {
	kind: ResourceCostKind;
	amount: number;
	/** The name of what the cost is for. */
	source: string;
}
