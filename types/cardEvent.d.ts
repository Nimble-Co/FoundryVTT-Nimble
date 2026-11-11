import type { MoveNode } from '#types/effectTree.js';
import type { MovementOffer } from '#types/movement.js';
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
	| 'note';

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

/**
 * What a line lets the reader do: Undo an end, or move as an offer lets. A Movement Offer line
 * holds its move and the offers it made; the card stores the same offers, so the token carries them.
 */
export type CardEventAction =
	| { kind: 'undoEnd'; row: EndedEffectRow }
	| { kind: 'movementOffer'; node: MoveNode; offers: MovementOffer[] };

/** One line of the Events strip of a chat card. */
export interface CardEvent {
	id: string;
	kind: CardEventKind;
	/** An image for the icon plate. */
	img?: string;
	/** A Font Awesome class for the icon plate, when there is no image. */
	icon?: string;
	text: CardEventText;
	cause?: CardEventText;
	action?: CardEventAction;
	/** When it happened, in ms. The lines show in this order. */
	at: number;
}

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
