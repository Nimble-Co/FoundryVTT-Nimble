import type { CardEvent, WaitingEndAction } from '#types/cardEvent.d.ts';
import { waitingEndEvent } from '#utils/lastsUntil/endedEffectEvent.js';
import { type EndMoment, endedByOf, sourceNameOf } from '#utils/lastsUntil/endLines.js';

/** The waiting line of one effect: where and why its end would put its ended line. */
export function waitingEndLine(
	effect: ActiveEffect,
	moment: EndMoment,
	{ escapeRollId, at = Date.now() }: { escapeRollId?: string; at?: number } = {},
): CardEvent {
	const holder = effect.parent as Actor;
	const { key, heading, reason, hostId, whisper } = moment;
	const endedBy = endedByOf(effect, moment);
	const action: WaitingEndAction = {
		kind: 'waitingEnd',
		holderUuid: holder.uuid ?? '',
		holderName: holder.name ?? '',
		effectId: effect.id ?? '',
		effectName: effect.name ?? '',
		state: 'waiting',
		end: {
			...(key ? { key } : {}),
			heading,
			...(reason ? { reason } : {}),
			...(hostId ? { hostId } : {}),
			...(whisper ? { whisper } : {}),
		},
		...(endedBy ? { endedBy: endedBy.lastsUntil } : {}),
		...(escapeRollId ? { escapeRollId } : {}),
	};
	return waitingEndEvent({
		action,
		img: effect.img as string | null,
		sourceName: sourceNameOf(effect),
		endedBy,
		at,
	});
}
