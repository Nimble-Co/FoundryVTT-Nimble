import { SYSTEM_ID, systemHookName } from '#system';
import type { CardEvent, SaveRequestAction } from '#types/cardEvent.d.ts';
import { addCardEvents, cardEventsOf, replaceCardEvent } from '#utils/chat/cardEvents.js';
import { endEffects } from '#utils/lastsUntil/endEffects.js';
import { keptD20 } from '#utils/reroll/checkRollOfCard.js';
import { checkResult } from '#utils/rolls/checkResult.js';
import { resolveSaveNodeDC } from '#utils/rolls/saveNodeDC.js';
import { canShowDiceAnimation, showDiceAnimation } from '#utils/rolls/showDiceAnimation.js';
import type { SaveOnEvent } from '../../models/rules/saveOnEvent.js';

const QUERY_NAME = `${SYSTEM_ID}.resolveSaveRequest`;
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
	rollSavingThrow(
		save: string,
		options: { dc?: number },
	): Promise<{ roll: foundry.dice.Roll | null }>;
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

/** The owner of the holder, or a GM, rolls the save. */
export function canRollRequest(action: SaveRequestAction): boolean {
	return !!game.user?.isGM || !!holderOfRequest(action)?.isOwner;
}

/** Rolls the save in the normal save window, shows the dice, and gives the total to the GM. */
export async function rollRequestedSave(card: RequestCard, event: CardEvent): Promise<boolean> {
	const action = event.action as SaveRequestAction | undefined;
	if (action?.kind !== 'saveRequest' || action.state !== 'waiting' || !card.id) return false;
	const holder = holderOfRequest(action);
	if (!holder) return false;
	const { roll } = await holder.rollSavingThrow(action.save, { dc: action.dc });
	if (!roll) return false;
	if (canShowDiceAnimation()) await showDiceAnimation(roll as never);
	const data = {
		messageId: card.id,
		eventId: event.id,
		total: Number(roll.total ?? 0),
		keptD20: keptD20(roll.terms as unknown[]),
	};
	if (game.user?.isActiveGM) return resolveSaveRequest(data);
	const gm = (game.users as unknown as { activeGM?: { query(n: string, d: object): unknown } })
		.activeGM;
	return (await gm?.query(QUERY_NAME, data)) === true;
}

/** Two clients can roll the same line; the GM takes only the first result. */
const resolving = new Set<string>();

interface ResolveData {
	messageId: string;
	eventId: string;
	total: number;
	keptD20: number | null;
}

/**
 * On the active GM: the result goes on the line. A pass keeps the effect; a fail ends it, with
 * its ended line on the same card. Save rules hear the result as for a save card.
 */
export async function resolveSaveRequest(data: ResolveData): Promise<boolean> {
	const key = `${data.messageId}:${data.eventId}`;
	if (resolving.has(key)) return false;
	resolving.add(key);
	try {
		return await resolveOnce(data);
	} finally {
		resolving.delete(key);
	}
}

async function resolveOnce(data: ResolveData): Promise<boolean> {
	const card = game.messages?.get(data.messageId) as unknown as RequestCard | undefined;
	const event = card ? cardEventsOf(card as never).find((each) => each.id === data.eventId) : null;
	const action = event?.action as SaveRequestAction | undefined;
	if (!card || !event || action?.kind !== 'saveRequest' || action.state !== 'waiting') return false;
	const holder = holderOfRequest(action);
	const result = checkResult({
		kind: 'save',
		total: data.total,
		keptD20: data.keptD20,
		dc: action.dc,
	});
	const passed = result === 'succeeded';
	const rolled = { save: { key: saveWord(action.save) }, total: data.total, dc: action.dc };

	// @ts-expect-error - nimble.saveResolved is a custom Nimble hook
	Hooks.callAll(systemHookName('saveResolved'), {
		actor: holder,
		saveType: action.save,
		outcome: passed ? 'pass' : 'fail',
		messageId: card.id,
	});

	if (passed) {
		return replaceCardEvent(card as never, event.id, {
			...event,
			text: { key: `${WORDS}.kept`, data: { name: action.holderName, effect: action.effectName } },
			cause: { key: `${WORDS}.rolled`, data: rolled },
			action: { ...action, state: 'kept', total: data.total },
		});
	}
	await replaceCardEvent(card as never, event.id, null);
	const effect = holder?.effects.get(action.effectId);
	if (effect) {
		await endEffects([effect], {
			heading: event.text,
			hostId: card.id ?? undefined,
			reason: { key: `${WORDS}.rolled`, data: rolled },
		});
	}
	return true;
}

export function registerSaveRequestQuery(): void {
	Hooks.once('init', () => {
		const queries = CONFIG.queries as unknown as Record<string, (data: never) => Promise<boolean>>;
		queries[QUERY_NAME] = (data: ResolveData) => resolveSaveRequest(data);
	});
}
