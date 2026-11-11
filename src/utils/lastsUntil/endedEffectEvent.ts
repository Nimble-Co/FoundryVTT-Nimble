import type { CardEvent, CardEventText, EndedEffectRow } from '#types/cardEvent.d.ts';

/** The line for an ended effect, with Undo. `reason` says why it ended, when the moment does not. */
export function endedEffectEvent(
	row: EndedEffectRow,
	at: number,
	reason?: CardEventText,
): CardEvent {
	const source = row.sourceName;
	let cause: CardEventText | undefined;
	if (reason && source) {
		cause = { key: 'NIMBLE.chat.events.cause.reasonAndSource', data: { reason, source } };
	} else if (reason) {
		cause = reason;
	} else if (source) {
		cause = { key: 'NIMBLE.chat.events.cause.source', data: { source } };
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
