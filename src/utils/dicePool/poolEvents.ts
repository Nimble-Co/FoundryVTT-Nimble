import type { CardEvent, CardEventText } from '#types/cardEvent.d.ts';
import { cardEventId } from '../chat/activationEvents.js';
import type { RaisedFace } from './types.js';

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

/** Why the faces are what they are: the item, and the dice raised to the pool's lowest face. */
function poolRollCause(
	item: EventSource | null | undefined,
	pool: string,
	raised: readonly RaisedFace[],
): CardEventText | undefined {
	if (raised.length > 0) {
		return {
			key: 'NIMBLE.dicePoolTracker.raisedToFloor',
			data: {
				flavor: item?.name || pool,
				rolled: facesText(raised.map((die) => die.rolled)),
				face: facesText(raised.map((die) => die.face)),
			},
		};
	}
	if (!item?.name) return undefined;
	return { key: 'NIMBLE.chat.events.cause.source', data: { source: item.name } };
}

/** The line for dice an item use rolled for a pool: the faces after any raise to its lowest face. */
export function poolRollEvent(
	item: EventSource | null | undefined,
	pool: string,
	faces: readonly number[],
	raised: readonly RaisedFace[] = [],
): CardEvent {
	const cause = poolRollCause(item, pool, raised);
	return {
		id: cardEventId('poolRoll'),
		kind: 'poolRoll',
		...plate(item, 'fa-solid fa-dice'),
		text: { key: 'NIMBLE.chat.events.poolRoll.text', data: { pool, faces: facesText(faces) } },
		...(cause ? { cause } : {}),
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
