/** A data value of a card text: plain text, a number, or a lang text that each reader localizes. */
export type CardEventValue = string | number | CardEventText;

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

export type CardEventAction = { kind: 'undoEnd'; row: EndedEffectRow };

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
