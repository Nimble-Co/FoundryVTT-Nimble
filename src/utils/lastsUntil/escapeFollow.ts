import { SYSTEM_ID, systemHookName } from '#system';
import type { CardEvent, CardEventText } from '#types/cardEvent.d.ts';
import { cardEventsOf, replaceCardEvent } from '#utils/chat/cardEvents.js';
import { keyedQueue } from '#utils/keyedQueue.js';
import { endEffects, undoEndedEffect } from '#utils/lastsUntil/endEffects.js';
import localize from '#utils/localize.js';

/** On the roll card of an Escape: the effect it tries to end. */
export interface EscapeRollLink {
	holderUuid: string;
	holderName: string;
	effectId: string;
	effectName: string;
	noDc: boolean;
}

export const ESCAPE_ROLL_FLAG = 'escapeRoll';

interface EscapeCard {
	id?: string | null;
	type?: string;
	system?: unknown;
	flags?: Record<string, unknown>;
	rolls?: Array<{ total?: number | null }>;
}

interface EscapeHolder {
	effects: { get(id: string): ActiveEffect | undefined };
}

function linkOf(card: EscapeCard | null | undefined): EscapeRollLink | null {
	const flags = (card?.flags?.[SYSTEM_ID] ?? {}) as Record<string, unknown>;
	return (flags[ESCAPE_ROLL_FLAG] as EscapeRollLink | undefined) ?? null;
}

/** The words of an Escape's roll card, or null for any other card. */
export function escapeRollNote(card: EscapeCard | null | undefined): string | null {
	const link = linkOf(card);
	return link ? localize('NIMBLE.escape.note', { effect: link.effectName }) : null;
}

function rollTextOf(card: EscapeCard): CardEventText {
	const system = (card.system ?? {}) as { saveKey?: string };
	return {
		key: 'NIMBLE.escape.save',
		data: { save: { key: `NIMBLE.effectSheet.escape.saves.${system.saveKey ?? ''}` } },
	};
}

function escapedReason(card: EscapeCard): CardEventText {
	const roll = rollTextOf(card);
	const total = Number(card.rolls?.[0]?.total ?? 0);
	const dc = (card.system as { dc?: number | null } | undefined)?.dc;
	return typeof dc === 'number'
		? { key: 'NIMBLE.escape.chat.escaped', data: { roll, total, dc } }
		: { key: 'NIMBLE.escape.chat.escapedNoDc', data: { roll, total } };
}

const queue = keyedQueue();

/**
 * On the active GM, each time the result of an Escape's roll card changes: a pass ends the effect,
 * with its ended line on that card; a fail after a pass puts the effect back and removes the line.
 */
export async function followEscape(payload: {
	messageId?: string | null;
	outcome: string;
}): Promise<boolean> {
	if (!game.user?.isActiveGM) return false;
	const card = game.messages?.get(payload.messageId ?? '') as unknown as EscapeCard | undefined;
	const link = linkOf(card);
	if (!card?.id || !link) return false;
	return queue.run(card.id, () => follow(card, link, payload.outcome));
}

async function follow(card: EscapeCard, link: EscapeRollLink, outcome: string): Promise<boolean> {
	const ended = cardEventsOf(card as never).find(
		(event: CardEvent) =>
			event.action?.kind === 'undoEnd' &&
			event.action.row.effectId === link.effectId &&
			event.action.row.holderUuid === link.holderUuid,
	);
	const holder = fromUuidSync(link.holderUuid as never, { strict: false }) as EscapeHolder | null;
	const effect = holder?.effects.get(link.effectId);

	if (outcome === 'pass') {
		if (ended || !effect) return true;
		await endEffects([effect], {
			heading: { key: 'NIMBLE.escape.note', data: { effect: link.effectName } },
			hostId: card.id ?? '',
			reason: escapedReason(card),
		});
		return true;
	}

	if (outcome === 'fail' && ended?.action?.kind === 'undoEnd') {
		if (!effect) await undoEndedEffect(ended.action.row);
		await replaceCardEvent(card as never, ended.id, null);
	}
	return true;
}

let didRegister = false;

export function registerEscapeHooks(): void {
	if (didRegister) return;
	didRegister = true;
	// @ts-expect-error - nimble.saveResolved is a custom Nimble hook
	Hooks.on(systemHookName('saveResolved'), (payload: { messageId?: string; outcome: string }) => {
		if (!game.user?.isActiveGM) return;
		void followEscape(payload).catch((error) => {
			console.error('Nimble | An Escape could not follow its roll card.', error);
		});
	});
}
