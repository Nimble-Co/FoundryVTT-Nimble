import { SYSTEM_ID, systemHookName } from '#system';
import type { CardEvent, SaveRequestAction } from '#types/cardEvent.d.ts';
import {
	addCardEvents,
	cardEventsOf,
	cardEventText,
	replaceCardEvent,
} from '#utils/chat/cardEvents.js';
import { keyedQueue } from '#utils/keyedQueue.js';
import { endEffects, undoEndedEffect } from '#utils/lastsUntil/endEffects.js';
import { resolveSaveNodeDC } from '#utils/rolls/saveNodeDC.js';
import type { SaveOnEvent } from '../../models/rules/saveOnEvent.js';

const WORDS = 'NIMBLE.chat.saveRequest';

interface SaveOnEventData {
	id?: string;
	type?: string;
	disabled?: boolean;
	event?: string;
	saveType?: string;
	saveDC?: string;
	/** A prepared rule: its predicate, and its DC from the holder's stats. */
	test?(): boolean;
	dc?: number;
}

interface SaverActor {
	uuid: string;
	name?: string | null;
	isOwner?: boolean;
	effects: Iterable<ActiveEffect> & { get(id: string): ActiveEffect | undefined };
	getRollData(): Record<string, unknown>;
	rollSavingThrowToChat(
		save: string,
		options: { dc?: number; cardFlags?: Record<string, unknown> },
	): Promise<unknown>;
}

interface RequestCard {
	id?: string | null;
	type?: string;
	timestamp?: number;
	flags?: Record<string, unknown>;
	system?: unknown;
}

const saveWord = (save: string) => `NIMBLE.effectSheet.escape.saves.${save}`;

/** The live rules of the effect for the event. A prepared rule also checks its predicate. */
function rulesOf(effect: ActiveEffect, event: SaveOnEvent): SaveOnEventData[] {
	const prepared = (effect as { rules?: { values?(): Iterable<SaveOnEventData> } }).rules;
	const rules =
		typeof prepared?.values === 'function'
			? [...prepared.values()]
			: ((effect.system as { rules?: SaveOnEventData[] } | undefined)?.rules ?? []);
	return rules.filter(
		(rule) =>
			rule?.type === 'saveOnEvent' &&
			!rule.disabled &&
			rule.event === event &&
			(typeof rule.test !== 'function' || rule.test()),
	);
}

function dcOf(rule: SaveOnEventData, actor: SaverActor): number {
	if (typeof rule.dc === 'number' && Number.isFinite(rule.dc)) return rule.dc;
	const formula = (rule.saveDC ?? '').trim() || '10';
	const plain = Number(formula);
	return Number.isFinite(plain) ? plain : (resolveSaveNodeDC(formula, actor as never) ?? 10);
}

/** A line for each "save on an event" rule on the creature's effects that the event asks. */
export function saveRequestEvents(
	actor: SaverActor,
	event: SaveOnEvent,
	at = Date.now(),
): CardEvent[] {
	const lines: CardEvent[] = [];
	for (const effect of actor.effects) {
		if (!effect.active) continue;
		for (const rule of rulesOf(effect, event)) {
			const save = rule.saveType ?? 'strength';
			const dc = dcOf(rule, actor);
			const action: SaveRequestAction = {
				kind: 'saveRequest',
				holderUuid: actor.uuid,
				holderName: actor.name ?? '',
				effectId: effect.id ?? '',
				effectName: effect.name ?? '',
				save,
				dc,
				state: 'waiting',
			};
			lines.push({
				id: `saveRequest.${actor.uuid}.${effect.id}.${rule.id ?? lines.length}.${at}`,
				kind: 'saveRequest',
				...(effect.img ? { img: effect.img } : { icon: 'fa-solid fa-shield-heart' }),
				text: { key: `${WORDS}.ask`, data: { name: action.holderName, effect: action.effectName } },
				cause: {
					key: `${WORDS}.cause.${event}`,
					data: { dc, save: { key: saveWord(save) } },
				},
				action,
				at,
			});
		}
	}
	return lines;
}

/** Whether the event asks the creature for a save. */
export function asksSave(actor: SaverActor | null | undefined, event: SaveOnEvent): boolean {
	return !!actor && saveRequestEvents(actor, event).length > 0;
}

/** Puts the save lines of the event on the card that caused it. */
export async function requestSaves(
	card: RequestCard | null | undefined,
	actor: SaverActor | null | undefined,
	event: SaveOnEvent,
): Promise<void> {
	if (!card?.id || !actor) return;
	const lines = saveRequestEvents(actor, event);
	if (lines.length) await addCardEvents(card as never, lines);
}

export function holderOfRequest(action: SaveRequestAction): SaverActor | null {
	return fromUuidSync(action.holderUuid as never, { strict: false }) as SaverActor | null;
}

/** The owner of the holder, or a GM, rolls the save, once. */
export function canRollRequest(action: SaveRequestAction): boolean {
	if (action.saveMessageId) return false;
	return !!game.user?.isGM || !!holderOfRequest(action)?.isOwner;
}

/** On the save card: the line it answers, as it was when rolled. */
interface SaveRequestLink {
	messageId: string;
	event: CardEvent;
}

interface SaveCard {
	id?: string | null;
	flags?: Record<string, unknown>;
	rolls?: Array<{ total?: number | null }>;
}

const LINK_FLAG = 'saveRequest';
const BOUND_FLAG = 'saveRequestRolls';

/** Rolls the save to chat as a normal save card, so reroll rules and reactions act on it. */
export async function rollRequestedSave(card: RequestCard, event: CardEvent): Promise<boolean> {
	const action = event.action as SaveRequestAction | undefined;
	if (action?.kind !== 'saveRequest' || action.state !== 'waiting' || !card.id) return false;
	if (action.saveMessageId) return false;
	const holder = holderOfRequest(action);
	if (!holder) return false;
	const link: SaveRequestLink = { messageId: card.id, event };
	const made = await holder.rollSavingThrowToChat(action.save, {
		dc: action.dc,
		cardFlags: { [LINK_FLAG]: link },
	});
	return !!made;
}

const queue = keyedQueue();

const flagsOf = (card: { flags?: Record<string, unknown> } | null | undefined) =>
	(card?.flags?.[SYSTEM_ID] ?? {}) as Record<string, unknown>;

/** The words of a save card for the effect that asked for it, or null for any other save. */
export function requestedSaveNote(saveCard: SaveCard | null | undefined): string | null {
	const link = flagsOf(saveCard)[LINK_FLAG] as SaveRequestLink | undefined;
	if (link?.event?.action?.kind !== 'saveRequest') return null;
	return cardEventText(link.event.text);
}

/** A flag key for a line id, which has dots. */
const boundKey = (eventId: string) => eventId.replaceAll('.', '_');

/**
 * On the active GM, each time the result of a save card changes: its line follows it. A pass
 * keeps the effect; a fail ends it, with its ended line on the same card; a reroll that turns a
 * fail into a pass puts the effect back. Only the first save card rolled for a line counts.
 */
export async function followSaveRequest(payload: {
	messageId?: string | null;
	outcome: string;
}): Promise<boolean> {
	const saveCard = game.messages?.get(payload.messageId ?? '') as unknown as SaveCard | undefined;
	const link = flagsOf(saveCard)[LINK_FLAG] as SaveRequestLink | undefined;
	if (!saveCard?.id || !link?.event?.id) return false;
	return queue.run(link.event.id, () => follow(saveCard, link, payload.outcome));
}

async function follow(saveCard: SaveCard, link: SaveRequestLink, outcome: string) {
	const card = game.messages?.get(link.messageId) as unknown as
		| (RequestCard & { update(changes: object): Promise<unknown> })
		| undefined;
	const asked = link.event.action as SaveRequestAction | undefined;
	if (!card?.id || asked?.kind !== 'saveRequest' || !saveCard.id) return false;

	const key = boundKey(link.event.id);
	const bound = (flagsOf(card)[BOUND_FLAG] as Record<string, string> | undefined)?.[key];
	if (bound && bound !== saveCard.id) return false;
	if (!bound) await card.update({ [`flags.${SYSTEM_ID}.${BOUND_FLAG}.${key}`]: saveCard.id });

	const events = cardEventsOf(card as never);
	const line = events.find((each) => each.id === link.event.id);
	const ended = line
		? undefined
		: events.find(
				(each) =>
					each.action?.kind === 'undoEnd' &&
					each.action.row.effectId === asked.effectId &&
					each.action.row.holderUuid === asked.holderUuid,
			);
	if (!line && !ended) return false;

	const total = Number(saveCard.rolls?.[0]?.total ?? 0);
	const rolled = { save: { key: saveWord(asked.save) }, total, dc: asked.dc };
	const action: SaveRequestAction = { ...asked, saveMessageId: saveCard.id };

	if (outcome === 'fail') {
		if (!line) return true;
		await replaceCardEvent(card as never, line.id, null);
		const effect = holderOfRequest(asked)?.effects.get(asked.effectId);
		if (effect) {
			await endEffects([effect], {
				heading: link.event.text,
				hostId: card.id,
				reason: { key: `${WORDS}.rolled`, data: rolled },
			});
		}
		return true;
	}

	const next: CardEvent =
		outcome === 'pass'
			? {
					...link.event,
					text: {
						key: `${WORDS}.kept`,
						data: { name: asked.holderName, effect: asked.effectName },
					},
					cause: { key: `${WORDS}.rolled`, data: rolled },
					action: { ...action, state: 'kept', total },
				}
			: { ...link.event, action: { ...action, state: 'waiting' } };
	if (ended?.action?.kind === 'undoEnd') {
		await undoEndedEffect(ended.action.row);
		return replaceCardEvent(card as never, ended.id, next);
	}
	return replaceCardEvent(card as never, link.event.id, next);
}

/**
 * On the active GM: when the save card of a line that waits is deleted, the line can be rolled
 * again. A result that the line shows stays.
 */
export async function releaseSaveRequest(saveCard: SaveCard): Promise<boolean> {
	const link = flagsOf(saveCard)[LINK_FLAG] as SaveRequestLink | undefined;
	if (!saveCard.id || !link?.event?.id) return false;
	return queue.run(link.event.id, async () => {
		const card = game.messages?.get(link.messageId) as unknown as
			| (RequestCard & { update(changes: object): Promise<unknown> })
			| undefined;
		if (!card?.id) return false;
		const key = boundKey(link.event.id);
		const bound = (flagsOf(card)[BOUND_FLAG] as Record<string, string> | undefined)?.[key];
		if (bound !== saveCard.id) return false;
		const line = cardEventsOf(card as never).find((each) => each.id === link.event.id);
		const action = line?.action as SaveRequestAction | undefined;
		if (!line || action?.kind !== 'saveRequest' || action.state !== 'waiting') return false;
		await card.update({
			[`flags.${SYSTEM_ID}.${BOUND_FLAG}.${key}`]: new foundry.data.operators.ForcedDeletion(),
		});
		const { saveMessageId: _, ...open } = action;
		return replaceCardEvent(card as never, line.id, { ...line, action: open });
	});
}

let didRegister = false;

export function registerSaveRequestHooks(): void {
	if (didRegister) return;
	didRegister = true;
	Hooks.on('deleteChatMessage', (card: unknown) => {
		if (!game.user?.isActiveGM) return;
		void releaseSaveRequest(card as SaveCard).catch((error) => {
			console.error('Nimble | A save request could not be opened again.', error);
		});
	});
	// @ts-expect-error - nimble.saveResolved is a custom Nimble hook
	Hooks.on(systemHookName('saveResolved'), (payload: { messageId?: string; outcome: string }) => {
		if (!game.user?.isActiveGM) return;
		void followSaveRequest(payload).catch((error) => {
			console.error('Nimble | A save request could not follow its save card.', error);
		});
	});
}
