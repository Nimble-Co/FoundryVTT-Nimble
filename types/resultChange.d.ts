import type { CheckResult } from './checkResult.d.ts';
import type { ResultChangeKind } from '#utils/incomingReactions/incomingReactionEntry.ts';
import type { PaidRerollCost } from '#utils/reroll/rerollCost.ts';

/** What one use of a Change a Result rule does now. */
export interface ResultUse {
	change: ResultChangeKind;
	/** The new total for a set or a natural 20, the amount for an add, else 0. */
	value: number;
	/** The ability the formula is, such as `strength`. Empty when it is anything else. */
	stat: string;
}

/**
 * One click of a Change a Result rule on a check card. The card keeps the clicks
 * in order and works out its total from them, so its roll stays what the dice gave.
 */
export interface ResultChange extends ResultUse {
	id: string;
	/** The first click of its history line: repeats of an add share one line. */
	lineId: string;
	entryId: string;
	itemUuid: string;
	ruleId: string;
	label: string;
	actorUuid: string;
	/** A new roll took it off the total. Its cost stays paid and its line stays. */
	retired: boolean;
	/** The total this change replaced, set when a new roll retires it. */
	before: number | null;
	chargePoolIdentifier: string;
	/**
	 * What Remove gives back. An action or a heroic reaction goes back only in the
	 * turn of its stamp. A record from before them has none of the three.
	 */
	paid: Pick<PaidRerollCost, 'charges' | 'mana' | 'wounds'> &
		Partial<Pick<PaidRerollCost, 'action' | 'heroicReaction' | 'stamp'>>;
	/** Made with no click. It has no Remove. */
	automatic?: boolean;
	/** A no-damage change: the target it covers. */
	targetTokenUuid?: string | null;
}

/** A roll card now, for a gate on a rule that reads it. */
export interface ResultCardView {
	total: number;
	changes: readonly ResultChange[];
	/** Formulas read this creature's roll data. */
	roller: { name?: string | null; getRollData?: () => Record<string, unknown> } | null;
	/** A check card's result. Null or absent when the card cannot tell. */
	result?: CheckResult | null;
	/** The check roll's total without its d20. */
	rollModifier?: number;
	/** The kept d20 is a natural 1 that fails whatever is added. */
	naturalOneFails?: boolean;
	/** An attack card's damage is already applied. */
	damageApplied?: boolean;
}
