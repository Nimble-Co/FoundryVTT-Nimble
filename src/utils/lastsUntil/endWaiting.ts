import { SYSTEM_ID } from '#system';
import type { CardEvent, WaitingEndAction } from '#types/cardEvent.d.ts';
import { cardEventsOf, replaceCardEvent } from '#utils/chat/cardEvents.js';
import { mayActHere } from '#utils/chat/cardOperations.js';
import { activeGmLine, type LineCard, runMarked } from '#utils/chat/lineClick.js';
import { endEffects } from '#utils/lastsUntil/endEffects.js';
import { escapeOnEnd } from '#utils/lastsUntil/escapeFollow.js';

const QUERY_NAME = `${SYSTEM_ID}.endWaiting`;

interface WaitingHolder {
	effects: { get(id: string): ActiveEffect | undefined };
}

/** The owner of the holder, or a GM, ends a waiting effect. */
export function canEndWaiting(action: WaitingEndAction): boolean {
	return mayActHere(action.holderUuid);
}

const holderOf = (action: WaitingEndAction) =>
	fromUuidSync(action.holderUuid as never, { strict: false }) as WaitingHolder | null;

function goneLine(line: CardEvent, action: WaitingEndAction): CardEvent {
	return {
		...line,
		text: {
			key: 'NIMBLE.lastsUntil.chat.notOn',
			data: { effect: action.effectName, name: action.holderName },
		},
		action: { ...action, state: 'gone' },
	};
}

/**
 * Ends the effect through the end path of a moment, so its ended line, Undo and what an end sets
 * off all follow. The ended line takes the place of the waiting line. An Escape ends on its roll
 * card, with its damage; a line that moved from that card for its readers goes.
 */
async function endFromLine(
	card: LineCard & { id: string },
	line: CardEvent,
	action: WaitingEndAction,
	effect: ActiveEffect,
): Promise<void> {
	const replaces = { eventId: line.id, at: line.at };
	if (!action.escapeRollId) {
		await endEffects([effect], {
			...action.end,
			hostId: card.id,
			replaces,
			...(action.endedBy && effect.uuid ? { endedBy: { [effect.uuid]: action.endedBy } } : {}),
		});
		return;
	}
	const onRollCard = card.id === action.escapeRollId;
	await escapeOnEnd(
		action.escapeRollId,
		action,
		action.end.reason ?? { key: '' },
		{ hostId: card.id, eventId: line.id },
		onRollCard ? replaces : undefined,
	);
	if (!onRollCard && !holderOf(action)?.effects.get(action.effectId)) {
		await replaceCardEvent(card as never, line.id, null);
	}
}

/**
 * On the active GM. The line is marked first (`runMarked`). An end that did not take puts the line
 * back to waiting, only while it is still marked: a reroll can take it off or change it meanwhile.
 */
async function endHere(card: LineCard, eventId: string): Promise<boolean> {
	const line = cardEventsOf(card as never).find((each) => each.id === eventId);
	const action = line?.action;
	if (!line || !card.id || action?.kind !== 'waitingEnd' || action.state !== 'waiting') {
		return false;
	}
	const marked: CardEvent = { ...line, action: { ...action, state: 'ending' } };
	return runMarked(card, line, marked, async () => {
		const holder = holderOf(action);
		const effect = holder?.effects.get(action.effectId);
		if (!effect) return replaceCardEvent(card as never, eventId, goneLine(line, action));
		await endFromLine(card as LineCard & { id: string }, line, action, effect);
		if (!holder?.effects.get(action.effectId)) return true;
		await replaceCardEvent(card as never, eventId, line, { ifState: 'ending' });
		return false;
	});
}

const endClick = activeGmLine(QUERY_NAME, endHere);

/** Feature Effects off: End on a waiting line. The active GM ends it; another client asks it. */
export async function endWaiting(card: LineCard, event: CardEvent): Promise<boolean> {
	const action = event.action;
	if (action?.kind !== 'waitingEnd' || action.state !== 'waiting') return false;
	if (!canEndWaiting(action)) return false;
	return endClick.click(card, event);
}

export function registerEndWaitingQuery(): void {
	endClick.register();
}
