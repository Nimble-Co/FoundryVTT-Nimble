import type { CardEvent, CardEventText } from '#types/cardEvent.d.ts';
import { cardEventId } from '../chat/activationEvents.js';

interface EventSource {
	name?: string | null;
	img?: string | null;
}

function plate(source: EventSource | null | undefined, icon: string) {
	return source?.img ? { img: source.img } : { icon };
}

/** The faces of a dice pool as the line shows them: "3, 4". */
export function facesText(faces: readonly number[]): string {
	return faces.join(', ');
}

/** The line for dice an item use rolled into a pool. */
export function poolRollEvent(
	item: EventSource | null | undefined,
	pool: string,
	faces: readonly number[],
): CardEvent {
	return {
		id: cardEventId('poolRoll'),
		kind: 'poolRoll',
		...plate(item, 'fa-solid fa-dice'),
		text: { key: 'NIMBLE.chat.events.poolRoll.text', data: { pool, faces: facesText(faces) } },
		...(item?.name
			? { cause: { key: 'NIMBLE.chat.events.cause.source', data: { source: item.name } } }
			: {}),
		at: Date.now(),
	};
}

/** The line of a pool gain notice, with the item of its rule as the source. */
export function poolGainEvent(source: EventSource | null | undefined, message: string): CardEvent {
	const cause: CardEventText | undefined = source?.name
		? { key: 'NIMBLE.chat.events.cause.source', data: { source: source.name } }
		: undefined;
	return {
		id: cardEventId('poolGain'),
		kind: 'poolGain',
		...plate(source, 'fa-solid fa-dice'),
		text: { key: 'NIMBLE.chat.events.poolGain.text', data: { message } },
		...(cause ? { cause } : {}),
		at: Date.now(),
	};
}
