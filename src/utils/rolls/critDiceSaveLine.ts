import { SYSTEM_ID } from '#system';
import type { CardEvent, CardEventText, CritDiceSaveAction } from '#types/cardEvent.d.ts';
import {
	addCardEvents,
	cardEventsOf,
	cardHoldingEvent,
	replaceCardEvent,
} from '#utils/chat/cardEvents.js';
import { mayActHere } from '#utils/chat/cardOperations.js';
import { activeGmLine, type LineCard, runMarked } from '#utils/chat/lineClick.js';
import {
	type CritDiceSaveLink,
	critDiceSaveState,
	settleCritDiceSave,
} from '#utils/rolls/critDiceSaveSettle.js';

const WORDS = 'NIMBLE.chat.critDiceSave';
const QUERY_NAME = `${SYSTEM_ID}.critDiceSaveLine`;

type Outcome = CritDiceSaveAction['outcome'];

const lineIdOf = (saveMessageId: string) => `critDiceSave.${saveMessageId}`;

function textKeyOf(action: CritDiceSaveAction): string {
	if (action.state === 'done') {
		if (action.outcome === 'fail') return 'maxDone';
		return action.outcome === 'pass' ? 'useBackDone' : 'takeBackDone';
	}
	if (action.outcome === 'fail') return action.spendsUse ? 'maxAndSpend' : 'max';
	if (action.outcome === 'pass') return action.restoresDice ? 'useBackAndDice' : 'useBack';
	return 'takeBack';
}

function textOf(action: CritDiceSaveAction): CardEventText {
	return { key: `${WORDS}.${textKeyOf(action)}`, data: { name: action.actorName } };
}

function lineOf(action: CritDiceSaveAction, at: number): CardEvent {
	return {
		id: lineIdOf(action.saveMessageId),
		kind: 'critDiceSave',
		icon: 'fa-solid fa-dice-d20',
		text: textOf(action),
		cause: { key: `${WORDS}.cause.${action.outcome}` },
		action,
		at,
	};
}

/**
 * Feature Effects off, on the active GM, each time the result of a crit dice save changes: its
 * save card gets a waiting line with what the result asks. A result that what a click did already
 * matches shows the line as done; one that asks for nothing takes it off.
 */
export async function showCritDiceSaveLine(
	saveCard: LineCard,
	link: CritDiceSaveLink,
	outcome: Outcome,
): Promise<void> {
	const attack = game.messages?.get(link.attackMessageId) as
		| { getFlag(scope: string, key: string): unknown }
		| undefined;
	if (!attack || !saveCard.id) return;
	const state = critDiceSaveState(attack);
	const id = lineIdOf(saveCard.id);
	const host = cardHoldingEvent(id, saveCard as never);
	const placed = host ? cardEventsOf(host as never).find((event) => event.id === id) : undefined;
	const actor = fromUuidSync(link.actorUuid as never, { strict: false }) as {
		name?: string | null;
	} | null;
	const base = {
		kind: 'critDiceSave' as const,
		actorUuid: link.actorUuid,
		actorName: actor?.name ?? '',
		saveMessageId: saveCard.id,
		outcome,
	};
	const wantsMax = outcome === 'fail';
	const wantsUseBack = outcome === 'pass';
	const hasMax = !!state.previous;

	if (wantsMax === hasMax && wantsUseBack === state.usesBack) {
		if (!placed || !host) return;
		const next = outcome === 'unknown' ? null : lineOf({ ...base, state: 'done' }, placed.at);
		await replaceCardEvent(host as never, id, next);
		return;
	}
	const next = lineOf(
		{
			...base,
			...(hasMax && !wantsMax ? { restoresDice: true } : {}),
			...(state.usesBack && !wantsUseBack ? { spendsUse: true } : {}),
			state: 'waiting',
		},
		placed?.at ?? Date.now(),
	);
	if (placed && host) await replaceCardEvent(host as never, id, next);
	else await addCardEvents(saveCard as never, [next]);
}

/** The owner of the creature whose rule asked for the save, or a GM, settles the line. */
export function canSettleCritDiceLine(action: CritDiceSaveAction): boolean {
	return mayActHere(action.actorUuid);
}

/** On the active GM. The line is marked done first (`runMarked`). */
async function settleHere(card: LineCard, eventId: string): Promise<boolean> {
	const line = cardEventsOf(card as never).find((event) => event.id === eventId);
	const action = line?.action;
	if (!line || action?.kind !== 'critDiceSave' || action.state !== 'waiting') return false;
	const saveCard = game.messages?.get(action.saveMessageId) as LineCard | undefined;
	const link = saveCard?.getFlag?.(SYSTEM_ID, 'critDiceSave') as CritDiceSaveLink | undefined;
	if (!link) return false;
	const done: CritDiceSaveAction = { ...action, state: 'done' };
	const marked: CardEvent = { ...line, text: textOf(done), action: done };
	return runMarked(card, line, marked, async () => {
		await settleCritDiceSave(link, action.outcome);
		return true;
	});
}

const settleClick = activeGmLine(QUERY_NAME, settleHere);

/** Feature Effects off: a click does what the result of the save asks, as Feature Effects on does. */
export async function settleCritDiceLine(card: LineCard, event: CardEvent): Promise<boolean> {
	const action = event.action;
	if (action?.kind !== 'critDiceSave' || action.state !== 'waiting') return false;
	if (!canSettleCritDiceLine(action)) return false;
	return settleClick.click(card, event);
}

export function registerCritDiceSaveLineQuery(): void {
	settleClick.register();
}
