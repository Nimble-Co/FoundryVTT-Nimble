import type {
	CardEvent,
	CardEventLastsUntil,
	CardEventText,
	EndedEffectRow,
	WaitingEndAction,
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

/** The cause of an end line: the Lasts Until moment, or else `why`; then the source. */
function endCause(
	source: string,
	why?: CardEventText,
	endedBy?: CardEventLastsUntil,
): CardEventText | undefined {
	const reason: CardEventText | undefined = endedBy
		? { key: 'NIMBLE.chat.events.cause.lastsUntil', data: { moment: endedBy } }
		: why;
	if (reason && source) return { key: REASON_AND_SOURCE, data: { reason, source } };
	if (reason) return reason;
	if (source) return { key: SOURCE, data: { source } };
	return undefined;
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
	const cause = endCause(row.sourceName, why, endedBy);
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

/**
 * Feature Effects off: the line of an end that waits for End, with the cause its ended line
 * would have.
 */
export function waitingEndEvent(input: {
	action: WaitingEndAction;
	img?: string | null;
	sourceName: string;
	endedBy?: CardEventLastsUntil;
	at: number;
}): CardEvent {
	const { action } = input;
	const cause = endCause(input.sourceName, action.end.reason, input.endedBy);
	const data = { effect: action.effectName, name: action.holderName };
	return {
		id: `waitingEnd.${action.holderUuid}.${action.effectId}.${input.at}`,
		kind: 'waitingEnd',
		...(input.img ? { img: input.img } : { icon: 'fa-solid fa-hourglass-half' }),
		text: { key: 'NIMBLE.lastsUntil.chat.endsOn', data },
		...(cause ? { cause } : {}),
		action,
		at: input.at,
	};
}
