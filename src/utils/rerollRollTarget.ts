import type { IncomingReactionEntry } from './incomingReactionEntry.js';
import type { RerollRollContext } from './rerollEntries.js';
import type { ReplacedRoll, RerollHistory, RolledDie } from './rerollStep.js';

/**
 * The part of a card reroll that changes with the kind of card. The card's
 * reroll flow (gate, reroll step, history, new entries, automatic rerolls)
 * talks only to this.
 */
interface RerollRollTarget<TRoll = unknown> {
	/** The card's roll now, as the reroll gate sees it. */
	context(): RerollRollContext;
	/** The roll a reroll replaces, or null when the card has none. */
	findRoll(): RerollableRoll<TRoll> | null;
}

/** One roll on a card that a reroll can replace. */
interface RerollableRoll<TRoll = unknown> {
	/** Which roll on the card this is, so the card can show its dice rolling in its place. */
	slot: string;
	replaced: ReplacedRoll;
	/** The replaced roll's kept primary die result, or null. */
	previousResult: number | null;
	/** Make and evaluate the new roll from the formula and options the reroll step gives. */
	makeRoll(formula: string, options: Record<string, unknown>): Promise<TRoll>;
	/** Read the new roll's kept die. Without it, the primary die of a damage roll is read. */
	readNewDie?(roll: TRoll): RolledDie;
	/**
	 * Do the card kind's own work for the new roll, and write nothing yet.
	 * `entries` are the card's entries with the used entry stamped.
	 */
	prepare(roll: TRoll, entries: IncomingReactionEntry[]): Promise<PreparedReroll>;
}

/** What the reroll flow adds to the card in the write that places the new roll. */
interface CardRerollChanges extends RerollHistory {
	incomingReactions: IncomingReactionEntry[];
}

/** A new roll that is ready to go on the card. */
interface PreparedReroll {
	/** The new roll as the reroll gate sees it. */
	context: RerollRollContext;
	/** The card's entries after the card kind's own changes to them. */
	entries: IncomingReactionEntry[];
	/** Put the new roll on the card in one write, with `changes`, and do what follows that write. */
	write(changes: CardRerollChanges): Promise<void>;
}

export type { CardRerollChanges, PreparedReroll, RerollableRoll, RerollRollTarget };
