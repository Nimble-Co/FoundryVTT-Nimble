import type {
	CardEvent,
	CardEventLastsUntil,
	CardEventText,
	EndedEffectRow,
} from '#types/cardEvent.d.ts';

const SOURCE = 'NIMBLE.chat.events.cause.source';
const REASON_AND_SOURCE = 'NIMBLE.chat.events.cause.reasonAndSource';

/** Why an ended line says the effect ended, without its source. */
export function endReasonOf(event: Pick<CardEvent, 'cause'>): CardEventText | undefined {
	const cause = event.cause;
	if (cause?.key === SOURCE) return undefined;
	if (cause?.key !== REASON_AND_SOURCE) return cause;
	const reason = cause.data?.reason;
	return typeof reason === 'object' && 'key' in reason ? reason : undefined;
}

/**
 * The line for an ended effect, with Undo. Its cause is the Lasts Until moment that ended it, or
 * else `reason`, when the heading does not say why; then the source.
 */
export function endedEffectEvent(
	row: EndedEffectRow,
	at: number,
	why?: CardEventText,
	endedBy?: CardEventLastsUntil,
): CardEvent {
	const source = row.sourceName;
	const reason: CardEventText | undefined = endedBy
		? { key: 'NIMBLE.chat.events.cause.lastsUntil', data: { moment: endedBy } }
		: why;
	let cause: CardEventText | undefined;
	if (reason && source) {
		cause = { key: REASON_AND_SOURCE, data: { reason, source } };
	} else if (reason) {
		cause = reason;
	} else if (source) {
		cause = { key: SOURCE, data: { source } };
	}
	return {
		id: `effectEnded.${row.holderUuid}.${row.effectId}.${at}`,
		kind: 'effectEnded',
		...(row.img ? { img: row.img } : { icon: 'fa-solid fa-hourglass-end' }),
		text: { key: 'NIMBLE.lastsUntil.chat.ended', data: { effect: row.name, name: row.holderName } },
		...(cause ? { cause } : {}),
		action: { kind: 'undoEnd', row },
		at,
	};
}
