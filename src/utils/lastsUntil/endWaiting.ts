import { SYSTEM_ID } from '#system';
import type { CardEvent, WaitingEndAction } from '#types/cardEvent.d.ts';
import { askActiveGm } from '#utils/askActiveGm.js';
import { cardEventsOf, replaceCardEvent } from '#utils/chat/cardEvents.js';
import { mayActHere } from '#utils/chat/cardOperations.js';
import { endEffects } from '#utils/lastsUntil/endEffects.js';
import { escapeOnEnd } from '#utils/lastsUntil/escapeFollow.js';

const QUERY_NAME = `${SYSTEM_ID}.endWaiting`;

interface LineCard {
	id?: string | null;
	type?: string;
	flags?: Record<string, unknown>;
	system?: unknown;
}

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
		onRollCard ? replaces : undefined,
	);
	if (!onRollCard && !holderOf(action)?.effects.get(action.effectId)) {
		await replaceCardEvent(card as never, line.id, null);
	}
}

/**
 * On the active GM. The line is marked first, only while it still waits, so of two clicks one
 * ends it. An end that did not take, or failed, puts the line back to waiting.
 */
async function endHere(card: LineCard, eventId: string): Promise<boolean> {
	const line = cardEventsOf(card as never).find((each) => each.id === eventId);
	const action = line?.action;
	if (!line || !card.id || action?.kind !== 'waitingEnd' || action.state !== 'waiting') {
		return false;
	}
	const marked: CardEvent = { ...line, action: { ...action, state: 'ending' } };
	if (!(await replaceCardEvent(card as never, eventId, marked, { ifState: 'waiting' }))) {
		return false;
	}
	const holder = holderOf(action);
	const effect = holder?.effects.get(action.effectId);
	if (!effect) return replaceCardEvent(card as never, eventId, goneLine(line, action));
	try {
		await endFromLine(card as LineCard & { id: string }, line, action, effect);
	} catch (error) {
		await replaceCardEvent(card as never, eventId, line);
		throw error;
	}
	if (!holder?.effects.get(action.effectId)) return true;
	await replaceCardEvent(card as never, eventId, line);
	return false;
}

/** Feature Effects off: End on a waiting line. The active GM ends it; another client asks it. */
export async function endWaiting(card: LineCard, event: CardEvent): Promise<boolean> {
	const action = event.action;
	if (action?.kind !== 'waitingEnd' || action.state !== 'waiting' || !card.id) return false;
	if (!canEndWaiting(action)) return false;
	if (!game.user?.isActiveGM) {
		return (await askActiveGm(QUERY_NAME, { messageId: card.id, eventId: event.id })) === true;
	}
	return endHere(card, event.id);
}

export function registerEndWaitingQuery(): void {
	Hooks.once('init', () => {
		const queries = CONFIG.queries as unknown as Record<string, (data: never) => Promise<boolean>>;
		queries[QUERY_NAME] = async (data: { messageId?: string; eventId?: string }) => {
			const card = game.messages?.get(data.messageId ?? '') as unknown as LineCard | undefined;
			if (!card?.id || !data.eventId) return false;
			return endHere(card, data.eventId);
		};
	});
}
