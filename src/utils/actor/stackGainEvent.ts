import type { CardEvent, CardEventText, StackGainAction } from '#types/cardEvent.d.ts';
import type { StackReached } from '#types/effectPayload.d.ts';
import { addCardEvents, addMomentEvents } from '#utils/chat/cardEvents.js';

const WORDS = 'NIMBLE.chat.stackGain';

/** The creature that has the stacking effect. */
export interface StackHolder {
	uuid: string;
	name?: string | null;
}

export function stackGainText(
	action: Pick<StackGainAction, 'holderName' | 'count' | 'stackedName' | 'gainedName'>,
	gained: boolean,
): CardEventText {
	const data = { name: action.holderName, count: action.count, stacked: action.stackedName };
	if (!gained) return { key: `${WORDS}.has`, data };
	return { key: `${WORDS}.gains`, data: { ...data, effect: action.gainedName } };
}

/**
 * The line of the "At N stacks" count: what the holder gained, with Undo; with Feature Effects
 * off, the count and a button that puts the effect on. With no effect to gain, the count only.
 */
export function stackGainEvent(
	holder: StackHolder,
	reached: StackReached,
	at = Date.now(),
): CardEvent {
	const base = {
		holderName: holder.name ?? '',
		count: reached.count,
		stackedName: reached.stackedName,
		gainedName: reached.gainedName,
	};
	const plate = reached.img ? { img: reached.img } : { icon: 'fa-solid fa-layer-group' };
	const event = { id: `stackGain.${holder.uuid}.${at}`, kind: 'stackGain' as const, ...plate, at };
	if (!reached.gainedUuid && !reached.payload)
		return { ...event, text: stackGainText(base, false) };
	const action: StackGainAction = {
		kind: 'stackGain',
		holderUuid: holder.uuid,
		...base,
		...(reached.gainedUuid
			? { state: 'gained', gainedUuid: reached.gainedUuid }
			: { state: 'waiting', payload: reached.payload }),
	};
	return { ...event, text: stackGainText(base, action.state === 'gained'), action };
}

/**
 * Writes the line on the card that caused the stack. With no such card, a line with a button gets
 * a card of its own; a count with nothing to gain gets no card.
 */
export async function postStackGain(
	holder: StackHolder,
	reached: StackReached,
	cardId: string | null | undefined,
): Promise<boolean> {
	const line = stackGainEvent(holder, reached);
	const card = cardId ? game.messages?.get(cardId) : null;
	if (card) return addCardEvents(card as never, [line]);
	if (!line.action) return false;
	const heading = { key: 'NIMBLE.chat.events.forHeading', data: { names: holder.name ?? '' } };
	return addMomentEvents({ key: `once:${foundry.utils.randomID()}`, heading }, [line]);
}
