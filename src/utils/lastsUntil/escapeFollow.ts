import { SYSTEM_ID, systemHookName } from '#system';
import type { CardEvent, CardEventText, EscapeRulingAction } from '#types/cardEvent.d.ts';
import { askActiveGm } from '#utils/askActiveGm.js';
import {
	addCardEvents,
	cardEventsOf,
	replaceCardEvent,
	splitByReaders,
} from '#utils/chat/cardEvents.js';
import { mayActHere } from '#utils/chat/cardOperations.js';
import {
	dealEscapeDamage,
	escapeDamageRulesOf,
	takeBackEscapeDamage,
} from '#utils/damage/escapeDamage.js';
import { keyedQueue } from '#utils/keyedQueue.js';
import {
	type EndMoment,
	endEffects,
	undoEndedEffect,
	waitingEndLine,
} from '#utils/lastsUntil/endEffects.js';
import { endReasonOf } from '#utils/lastsUntil/endedEffectEvent.js';
import localize from '#utils/localize.js';
import { isRuleAutomationEnabled } from '../../settings/automationSettings.js';

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
	whisper?: readonly (string | null)[];
	author?: { id?: string | null } | null;
}

interface EscapeHolder {
	uuid: string;
	name?: string | null;
	isOwner?: boolean;
	effects: { get(id: string): ActiveEffect | undefined };
	applyDamage(amount: number): Promise<unknown>;
	update(data: Record<string, unknown>, options?: object): Promise<unknown>;
}

const WORDS = 'NIMBLE.escape.chat';
const RULED = `${WORDS}.ruled`;
const QUERY_NAME = `${SYSTEM_ID}.escapeRuling`;

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
	const system = (card.system ?? {}) as { saveKey?: string; skillKey?: string };
	if (card.type === 'skillCheck') {
		const skills = CONFIG.NIMBLE.skills as unknown as Record<string, string>;
		return {
			key: 'NIMBLE.escape.check',
			data: { skill: { key: skills[system.skillKey ?? ''] ?? system.skillKey ?? '' } },
		};
	}
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
		? { key: `${WORDS}.escaped`, data: { roll, total, dc } }
		: { key: `${WORDS}.escapedNoDc`, data: { roll, total } };
}

/** The line of an Escape with no DC: it waits for the table, or the roll failed. */
export function escapeRulingEvent(
	link: EscapeRollLink,
	state: EscapeRulingAction['state'],
	{ at = Date.now(), rollMessageId }: { at?: number; rollMessageId?: string | null } = {},
): CardEvent {
	const action: EscapeRulingAction = {
		kind: 'escapeRuling',
		holderUuid: link.holderUuid,
		holderName: link.holderName,
		effectId: link.effectId,
		effectName: link.effectName,
		state,
		...(rollMessageId ? { rollMessageId } : {}),
	};
	const data = { name: link.holderName, effect: link.effectName };
	return {
		id: `escape.${link.holderUuid}.${link.effectId}.${at}`,
		kind: 'escape',
		icon: 'fa-solid fa-person-running',
		text: { key: state === 'waiting' ? `${WORDS}.tries` : `${WORDS}.failed`, data },
		...(state === 'waiting' ? { cause: { key: `${WORDS}.noDc` } } : {}),
		action,
		at,
	};
}

const holderOf = (link: { holderUuid: string }) =>
	fromUuidSync(link.holderUuid as never, { strict: false }) as EscapeHolder | null;

/** The owner of the holder, or a GM, judges an Escape with no DC. */
export function canRuleEscape(action: EscapeRulingAction): boolean {
	return mayActHere(action.holderUuid);
}

const endMoment = (effectName: string, hostId: string, reason: CardEventText): EndMoment => ({
	heading: { key: 'NIMBLE.escape.note', data: { effect: effectName } },
	hostId,
	reason,
});

/** The creature that applied the effect: the actor in its origin, or the actor of that item. */
function sourceUuidOf(effect: ActiveEffect): string | null {
	if (!effect.origin) return null;
	const origin = fromUuidSync(effect.origin as never, { strict: false }) as {
		documentName?: string;
		uuid?: string;
		actor?: { uuid?: string } | null;
	} | null;
	if (origin?.documentName === 'Actor') return origin.uuid ?? null;
	return origin?.actor?.uuid ?? null;
}

type EscapeTarget = Pick<EscapeRollLink, 'holderUuid' | 'effectId' | 'effectName'>;

/**
 * Ends the effect for an Escape, with its ended line on the card, in place of the waiting line
 * `replaces`. When this end removed it, the effect's Damage on Escape rules deal their damage on
 * the same card.
 */
async function escapeNow(
	card: EscapeCard,
	target: EscapeTarget,
	reason: CardEventText,
	replaces?: EndMoment['replaces'],
): Promise<boolean> {
	const holder = holderOf(target);
	const effect = holder?.effects.get(target.effectId);
	if (!holder || !effect || !card.id) return false;
	const rules = escapeDamageRulesOf(effect);
	const escaped = {
		effectId: target.effectId,
		effectName: target.effectName,
		img: (effect.img as string | null) ?? null,
		sourceUuid: sourceUuidOf(effect),
	};
	await endEffects([effect], {
		...endMoment(target.effectName, card.id, reason),
		...(replaces ? { replaces } : {}),
	});
	if (holder.effects.get(target.effectId)) return false;
	if (rules.length > 0) await dealEscapeDamage(card, holder as never, escaped, rules);
	return true;
}

const queue = keyedQueue();

/** The waiting line of an End click, which the click marked `ending`. */
interface MarkedLine {
	hostId: string;
	eventId: string;
}

/** A reroll to a fail takes the marked line off, or puts a ruling line in its place. */
function stillMarked({ hostId, eventId }: MarkedLine): boolean {
	const host = game.messages?.get(hostId);
	const line = host ? cardEventsOf(host as never).find((event) => event.id === eventId) : undefined;
	return line?.action?.kind === 'waitingEnd' && line.action.state === 'ending';
}

/**
 * On the active GM, End on the waiting line of an Escape that passed: the effect ends as a pass
 * ends it with Feature Effects on, on the roll card, with its damage. Nothing ends when the line
 * is no longer the one this click marked.
 */
export function escapeOnEnd(
	rollMessageId: string,
	target: EscapeTarget,
	reason: CardEventText,
	marked: MarkedLine,
	replaces?: EndMoment['replaces'],
): Promise<boolean> {
	const card = game.messages?.get(rollMessageId) as unknown as EscapeCard | undefined;
	if (!card?.id) return Promise.resolve(false);
	return queue.run(card.id, async () =>
		stillMarked(marked) ? escapeNow(card, target, reason, replaces) : false,
	);
}

/**
 * On the active GM, each time the result of an Escape's roll card changes: a pass ends the effect,
 * with its ended line and the escape damage on that card; a fail after a pass puts the effect
 * back, gives back the damage and removes the lines. With no DC, a result that is not known waits
 * for the table, and a fail says so.
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

/**
 * Escapes on a waiting line: the effect ends as on a pass, with its ended line on the same card,
 * and the waiting line goes. The active GM does it; another client asks the active GM.
 */
export async function endEscape(card: EscapeCard, event: CardEvent): Promise<boolean> {
	const action = event.action;
	if (action?.kind !== 'escapeRuling' || action.state !== 'waiting' || !card.id) return false;
	if (!canRuleEscape(action)) return false;
	if (!game.user?.isActiveGM) {
		const data = { messageId: card.id, eventId: event.id, rollMessageId: action.rollMessageId };
		return (await askActiveGm(QUERY_NAME, data)) === true;
	}
	return ruleHere(card, event.id, action.rollMessageId);
}

/**
 * Escapes ends the effect as a pass does: on the roll card, which keeps the ended line and the
 * damage when the waiting line moved to another card.
 */
function ruleHere(
	card: EscapeCard,
	eventId: string,
	rollMessageId: string | null | undefined,
): Promise<boolean> {
	const rollCard =
		!rollMessageId || rollMessageId === card.id
			? card
			: (game.messages?.get(rollMessageId) as unknown as EscapeCard | undefined);
	return queue.run(rollCard?.id ?? card.id ?? '', async () => {
		const line = cardEventsOf(card as never).find((each) => each.id === eventId);
		const action = line?.action;
		if (action?.kind !== 'escapeRuling' || action.state !== 'waiting') return false;
		if (!(await escapeNow(rollCard ?? card, action, { key: RULED }))) return false;
		await replaceCardEvent(card as never, eventId, null);
		return true;
	});
}

const sameEffect = (link: EscapeRollLink, row: { effectId: string; holderUuid: string }) =>
	row.effectId === link.effectId && row.holderUuid === link.holderUuid;

interface PlacedLine {
	host: EscapeCard;
	line: CardEvent;
}

/** The no-DC line of this roll card: on the card, or on the card it moved to for its readers. */
function rulingLineOf(card: EscapeCard, link: EscapeRollLink): PlacedLine | undefined {
	const isRuling = (event: CardEvent) =>
		event.action?.kind === 'escapeRuling' && sameEffect(link, event.action);
	const here = cardEventsOf(card as never).find(isRuling);
	if (here) return { host: card, line: here };
	const cards = ((game.messages as unknown as { contents?: EscapeCard[] })?.contents ?? []).slice();
	for (const host of cards.reverse()) {
		if (host.id === card.id) continue;
		const line = cardEventsOf(host as never).find(
			(event) =>
				isRuling(event) &&
				event.action?.kind === 'escapeRuling' &&
				event.action.rollMessageId === card.id,
		);
		if (line) return { host, line };
	}
	return undefined;
}

/** Feature Effects off: the waiting end of this roll card's pass, on the card or where it moved. */
function waitingLineOf(card: EscapeCard, link: EscapeRollLink): PlacedLine | undefined {
	const isWaiting = (event: CardEvent) =>
		event.action?.kind === 'waitingEnd' &&
		event.action.escapeRollId === card.id &&
		sameEffect(link, event.action);
	const cards = ((game.messages as unknown as { contents?: EscapeCard[] })?.contents ?? []).slice();
	for (const host of [card, ...cards.reverse()]) {
		const line = cardEventsOf(host as never).find(isWaiting);
		if (line) return { host, line };
	}
	return undefined;
}

/** The ended line says the table ruled the escape (**Escapes**). */
const wasRuled = (event: CardEvent) => endReasonOf(event)?.key === RULED;

async function follow(card: EscapeCard, link: EscapeRollLink, outcome: string): Promise<boolean> {
	const events = cardEventsOf(card as never);
	const ended = events.find(
		(event) => event.action?.kind === 'undoEnd' && sameEffect(link, event.action.row),
	);
	const ruling = rulingLineOf(card, link);
	const automated = isRuleAutomationEnabled();
	const waiting = automated ? undefined : waitingLineOf(card, link);
	const effect = holderOf(link)?.effects.get(link.effectId);
	/** The escape no longer stands: the effect and the damage of the escape go back. */
	const putBack = async () => {
		if (ended?.action?.kind === 'undoEnd' && !effect) await undoEndedEffect(ended.action.row);
		await takeBackEscapeDamage(card, link);
	};
	/**
	 * The line of an Escape with no DC takes the place of `placed` on its card, or is added. When
	 * the owner cannot read that card, `placed` goes and the line is added, so it moves for them.
	 */
	const showRuling = async (placed: PlacedLine | undefined, state: EscapeRulingAction['state']) => {
		const next = escapeRulingEvent(link, state, { rollMessageId: card.id });
		if (placed && splitByReaders(placed.host, [next]).elsewhere.length < 1) {
			return replaceCardEvent(placed.host as never, placed.line.id, {
				...next,
				id: placed.line.id,
			});
		}
		if (placed) await replaceCardEvent(placed.host as never, placed.line.id, null);
		return addCardEvents(card as never, [next]);
	};
	const endedHere = ended ? { host: card, line: ended } : undefined;

	if (outcome === 'pass') {
		if (ended || !effect) return true;
		if (automated) {
			await escapeNow(card, link, escapedReason(card));
		} else if (!waiting && card.id) {
			const moment = endMoment(link.effectName, card.id, escapedReason(card));
			await addCardEvents(card as never, [
				waitingEndLine(effect, moment, { escapeRollId: card.id }),
			]);
		}
		if (ruling) await replaceCardEvent(ruling.host as never, ruling.line.id, null);
		return true;
	}

	if (outcome === 'fail') {
		if (ended) {
			await putBack();
			if (link.noDc) await showRuling(endedHere, 'failed');
			else await replaceCardEvent(card as never, ended.id, null);
		} else if (waiting) {
			if (link.noDc) await showRuling(waiting, 'failed');
			else await replaceCardEvent(waiting.host as never, waiting.line.id, null);
		} else if (ruling && link.noDc) {
			await showRuling(ruling, 'failed');
		}
		return true;
	}

	if (!link.noDc) return true;
	const rulingAction = ruling?.line.action;
	// A result the table must judge again does not undo the table's ruling.
	if (ended && wasRuled(ended)) return true;
	if (ended) {
		await putBack();
		await showRuling(endedHere, 'waiting');
	} else if (waiting) {
		await showRuling(waiting, 'waiting');
	} else if (rulingAction?.kind !== 'escapeRuling' || rulingAction.state !== 'waiting') {
		await showRuling(ruling, 'waiting');
	}
	return true;
}

let didRegister = false;

export function registerEscapeHooks(): void {
	if (didRegister) return;
	didRegister = true;
	const onResult = (payload: { messageId?: string; outcome: string }) => {
		if (!game.user?.isActiveGM) return;
		void followEscape(payload).catch((error) => {
			console.error('Nimble | An Escape could not follow its roll card.', error);
		});
	};
	// @ts-expect-error - nimble.saveResolved is a custom Nimble hook
	Hooks.on(systemHookName('saveResolved'), onResult);
	// @ts-expect-error - nimble.skillCheckResolved is a custom Nimble hook
	Hooks.on(systemHookName('skillCheckResolved'), onResult);
	Hooks.once('init', () => {
		const queries = CONFIG.queries as unknown as Record<string, (data: never) => Promise<boolean>>;
		queries[QUERY_NAME] = async (data: {
			messageId?: string;
			eventId?: string;
			rollMessageId?: string;
		}) => {
			const card = game.messages?.get(data.messageId ?? '') as unknown as EscapeCard | undefined;
			if (!card?.id || !data.eventId) return false;
			return ruleHere(card, data.eventId, data.rollMessageId);
		};
	});
}
