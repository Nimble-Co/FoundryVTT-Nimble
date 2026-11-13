import type { MoveNode } from '#types/effectTree.js';
import type { MovementOffer } from '#types/movement.js';
import type { ActivationEvents } from '#utils/chat/activationEvents.js';
import type { Moment } from '#utils/lastsUntil/momentReached.js';

/**
 * A data value of a card text: plain text, a number, a lang text that each reader localizes, or
 * a Lasts Until moment that each reader reads as a sentence.
 */
export type CardEventValue = string | number | CardEventText | CardEventLastsUntil;

/** A Lasts Until moment, read by the holder of the effect: "Until your next attack". */
export interface CardEventLastsUntil {
	lastsUntil: Moment;
	/** The name of the creature that put the effect on, when it is not the holder. */
	source?: string;
}

/** A lang key and its data, localized on each client when the card renders. */
export interface CardEventText {
	key: string;
	data?: Record<string, CardEventValue>;
}

export type CardEventKind =
	| 'effectEnded'
	| 'freeUse'
	| 'poolGain'
	| 'poolRoll'
	| 'movementOffer'
	| 'interpose'
	| 'healthState'
	| 'damage'
	| 'saveRequest'
	| 'tempHpChoice';

/** One effect that a moment ended, with the data to make it again. */
export interface EndedEffectRow {
	effectId: string;
	holderUuid: string;
	holderName: string;
	name: string;
	img: string;
	sourceName: string;
	effect: Record<string, unknown>;
}

/** A save that an event asks of a creature (Save on an Event), and how it stands. */
export interface SaveRequestAction {
	kind: 'saveRequest';
	holderUuid: string;
	holderName: string;
	effectId: string;
	effectName: string;
	/** The item the effect came from, when its name is not the effect's name. */
	itemName?: string;
	save: string;
	dc: number;
	state: 'waiting' | 'kept';
	total?: number;
	/** The save card that answers the line, once its result is known. */
	saveMessageId?: string;
}

/** Temp HP do not combine: the owner keeps the amount the creature has or takes the new one. */
export interface TempHpChoiceAction {
	kind: 'tempHpChoice';
	holderUuid: string;
	holderName: string;
	had: number;
	amount: number;
	/** The effect that gives the new amount, which owns it once taken. */
	effectUuid: string | null;
	state: 'waiting' | 'kept' | 'took';
}

/**
 * What a line lets the reader do: Undo an end, roll a save, keep or take temp HP, or move as an
 * offer lets. A Movement Offer line holds its move and the offers it made; the card stores the same
 * offers, so the token carries them.
 */
export type CardEventAction =
	| SaveRequestAction
	| TempHpChoiceAction
	| { kind: 'undoEnd'; row: EndedEffectRow }
	| { kind: 'movementOffer'; node: MoveNode; offers: MovementOffer[] };

/** The icon plate of a line: an image, or a Font Awesome class when there is no image. */
export type CardEventPlate = { img: string; icon?: never } | { icon: string; img?: never };

/** One line of the Events strip of a chat card. */
export type CardEvent = CardEventPlate & {
	id: string;
	kind: CardEventKind;
	text: CardEventText;
	cause?: CardEventText;
	action?: CardEventAction;
	/** When it happened, in ms. The lines show in this order. */
	at: number;
};

/** The moment of a moment card: the key that finds its card, and the heading. */
export interface CardEventMoment {
	key: string;
	heading: CardEventText;
}

/**
 * Where a free use can show as one line: the card of the action that set it off, or the card of a
 * moment. Ids and plain data only, so a GM query can carry it.
 */
export type FreeUseHost = { cardId: string } | { moment: CardEventMoment };

/** Where the lines of a use go once its card exists. False: the caller posts its own card. */
export type EventSink = (events: CardEvent[]) => Promise<boolean>;

/**
 * Where the ends of an event go: the card of the action that caused it, or the card of a moment,
 * seen by `whisper` (empty or missing: everyone).
 */
export type EventHost =
	| { id?: string | null }
	| { moment: CardEventMoment; whisper?: string[] }
	| null
	| undefined;

/** A chat card that can take lines. */
export interface EventHostCard {
	id?: string | null;
	type?: string;
	whisper?: readonly (string | null)[];
	author?: { id?: string | null; isGM?: boolean } | null;
	flags?: Record<string, unknown>;
	update?(changes: object): Promise<unknown>;
}

/** The card that shows a Movement Offer as a line: a card, the card of a moment, or an item use. */
export type MovementOfferHost =
	| { card: EventHostCard }
	| { moment: CardEventMoment }
	| { activation: ActivationEvents };

export type TurnMomentType = 'turnStart' | 'turnEnd';

/** The round and the index in the turn order of a turn, when the combat says them. */
export interface TurnPlace {
	round?: number;
	turn?: number | null;
}
