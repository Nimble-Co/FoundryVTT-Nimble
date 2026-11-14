/** What puts one effect on one actor. It goes to the GM as it is, so it holds only plain data. */
export interface EffectPayload {
	/** Active Effect source data: name, img, description, statuses, duration, system. */
	data: Record<string, unknown>;
	sourceItemUuid: string | null;
	sourceActorUuid: string | null;
	/** The temp HP that the effect gives, from a temp healing roll of the card. */
	tempHp?: number | null;
	/** The card whose use applies it: the events of the new effect go on it. */
	cardId?: string | null;
}

/** What the holder gains at the "At N stacks" count. No gained name: the item has no such effect. */
export interface StackReached {
	count: number;
	stackedName: string;
	gainedName: string;
	img?: string;
	/** The effect the holder gained. */
	gainedUuid?: string;
	/** Feature Effects off: what a click puts on. */
	payload?: EffectPayload;
}
