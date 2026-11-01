import type { PickableDie } from '../../src/dice/oneDieReroll.ts';
import type { IncomingReactionEntry } from '#utils/incomingReactions/incomingReactionEntry.ts';
import type { StatChoice } from '#utils/reroll/rollStat.ts';

/**
 * Where on the card the prompts render. `roll` is inside the damage section of
 * an attack: the history and Change This Roll with all its rows. `checkRoll` is
 * the same under the first roll of a check card, with only the rows that change
 * the roll. `options` is after Apply Damage: the lines of used entries, and the
 * rows that do not change the roll when the card has no `roll` place.
 */
export type IncomingReactionPlace = 'roll' | 'checkRoll' | 'options';

/** The kinds of use, in the order Change This Roll lists them. */
export type ReactionVerb = 'reroll' | 'change' | 'crit' | 'result' | 'addDamage' | 'interpose';

export interface IncomingReactionPromptsProps {
	place: IncomingReactionPlace;
}

export interface IncomingReactionActorGroup {
	actorUuid: string;
	/** Empty for the one who rolled: the card's header already names them. */
	name: string;
	entries: IncomingReactionEntry[];
}

/** A reroll or change whose die or value the player is picking, or whose request is out. */
export interface IncomingReactionPicking {
	entry: IncomingReactionEntry;
	dice: PickableDie[];
	rolling: PickableDie | null;
	/** The request for the picked die is out. */
	sent: boolean;
	/** A change that sets a value: the die step leads to the value step. */
	setsValue?: boolean;
	/** The die whose new value the player picks. */
	valueDie?: PickableDie | null;
	/** A reroll with another stat: the stats the player picks from. */
	stats?: StatChoice[];
}

/** Entries whose request is out, so their buttons stay hidden until it comes back. */
export interface HeldIncomingReactions {
	has(entryId: string): boolean;
	hold(entryId: string): void;
	release(entryId: string): void;
}

/** The words of one row of Change This Roll. */
export interface IncomingReactionRow {
	verb: string;
	/** "with Lucky". Empty when no feature gives the row. */
	withFeature: string;
	/** Empty when the row costs nothing the card knows about. */
	cost: string;
	/** A short note under the words. Empty when the entry has none. */
	note: string;
	/** The row as a sentence, for the screen reader. */
	sentence: string;
}

/** The words and icons the card shows for an entry. */
export interface IncomingReactionText {
	reactingActor(entry: IncomingReactionEntry): Actor.Implementation | null;
	documentName(uuid: string): string;
	featureName(entry: IncomingReactionEntry): string;
	/** The name the dice pool window shows for a spend offer. */
	spendLabel(entry: IncomingReactionEntry): string;
	row(entry: IncomingReactionEntry): IncomingReactionRow;
	icon(entry: IncomingReactionEntry): string;
	usedAttribution(entry: IncomingReactionEntry): string;
}
