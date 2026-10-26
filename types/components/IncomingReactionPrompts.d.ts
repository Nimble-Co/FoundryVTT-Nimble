import type { IncomingReactionEntry } from '#utils/incomingReactionEntry.ts';

/**
 * Where on the card the prompts render. `roll` is inside the roll section:
 * the buttons that change the roll and the last reroll. `options` is after
 * Apply Damage: every other card button.
 */
export type IncomingReactionPlace = 'roll' | 'options';

export interface IncomingReactionPromptsProps {
	place: IncomingReactionPlace;
}

export interface IncomingReactionActorGroup {
	actorUuid: string;
	/** Empty for the one who rolled: the card's header already names them. */
	name: string;
	entries: IncomingReactionEntry[];
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
	label(entry: IncomingReactionEntry): string;
	icon(entry: IncomingReactionEntry): string;
	tooltip(entry: IncomingReactionEntry): string | null;
	cost(entry: IncomingReactionEntry): string;
	usedAttribution(entry: IncomingReactionEntry): string;
}
