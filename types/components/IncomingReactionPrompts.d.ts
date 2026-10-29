import type { PickableDie } from '../../src/dice/oneDieReroll.ts';
import type { IncomingReactionEntry } from '#utils/incomingReactions/incomingReactionEntry.ts';

/**
 * Where on the card the prompts render. `roll` is inside the roll section:
 * the buttons that change the roll and the last reroll. `options` is after
 * Apply Damage: every other card button. A one-line roll splits `roll` in two:
 * `rollButton` is the reroll icon in the roll row, `rollHistory` the reroll
 * lines under it.
 */
export type IncomingReactionPlace = 'roll' | 'rollButton' | 'rollHistory' | 'options';

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
}

/** Entries whose request is out, so their buttons stay hidden until it comes back. */
export interface HeldIncomingReactions {
	has(entryId: string): boolean;
	hold(entryId: string): void;
	release(entryId: string): void;
}

/** The words and icons the card shows for an entry. */
export interface IncomingReactionText {
	reactingActor(entry: IncomingReactionEntry): Actor.Implementation | null;
	documentName(uuid: string): string;
	featureName(entry: IncomingReactionEntry): string;
	/** The full sentence: "Reroll with Lucky". */
	label(entry: IncomingReactionEntry): string;
	/** The short name in a verb's menu: "Lucky". */
	menuName(entry: IncomingReactionEntry): string;
	icon(entry: IncomingReactionEntry): string;
	cost(entry: IncomingReactionEntry): string;
	usedAttribution(entry: IncomingReactionEntry): string;
}
