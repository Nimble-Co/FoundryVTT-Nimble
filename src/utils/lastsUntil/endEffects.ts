import { SYSTEM_ID } from '#system';
import type {
	CardEvent,
	CardEventLastsUntil,
	CardEventText,
	EndedEffectRow,
	WaitingEndAction,
} from '#types/cardEvent.d.ts';
import { EFFECT_RECREATED_OPTION } from '#utils/actor/applyConditionToActor.js';
import {
	addCardEvents,
	addMomentEvents,
	canHost,
	replaceCardEvent,
} from '#utils/chat/cardEvents.js';
import { END_LINES_OPTION, emptyPoolEvents } from '#utils/dicePool/emptyPoolLine.js';
import { keyedQueue } from '#utils/keyedQueue.js';
import {
	effectEndsAt,
	endingMoment,
	reachedEndKey,
	turnsSeenAfter,
} from '#utils/lastsUntil/effectEndsAt.js';
import { sourceOf } from '#utils/lastsUntil/effectSubject.js';
import { endedEffectEvent, waitingEndEvent } from '#utils/lastsUntil/endedEffectEvent.js';
import type { LastsUntilCheck, Moment } from '#utils/lastsUntil/momentReached.js';
import localize from '#utils/localize.js';
import { isRuleAutomationEnabled } from '../../settings/automationSettings.js';

const QUERY_NAME = `${SYSTEM_ID}.endTimedEffects`;
/** On an effect: the one-time moments (`reachedEndKey`) that gave their waiting line. */
const END_WAITS_FLAG = 'endWaits';

/** The moment that ends the effects: its card and why they ended. */
export interface EndMoment {
	/** Finds the card of the moment (`momentKeys`). Without a key, the ends get their own card. */
	key?: string;
	heading: CardEventText;
	/** Why they ended, on each line, when the heading does not say it. */
	reason?: CardEventText;
	/** The card of the action that ended them. Its Events strip takes the lines, not a moment card. */
	hostId?: string;
	/** The Lasts Until moment that ended each effect, by effect UUID. */
	endedBy?: Record<string, Moment>;
	/** Who sees the card of the moment. Empty or missing: everyone. */
	whisper?: string[];
	/** The waiting line on the host card that the ended line takes the place of, with its time. */
	replaces?: { eventId: string; at: number };
}

/** Where the check happened: the moments it reached are read here, before the effects go. */
export interface EndCheck {
	check: LastsUntilCheck;
	combat?: Combat | null;
}

const queue = keyedQueue();
const ending = new Set<string>();

/** Every actor of the world: the world actors and the actors of unlinked tokens. */
export function* everyActor(): Generator<Actor> {
	const seen = new Set<Actor>();
	for (const actor of (game.actors ?? []) as Iterable<Actor>) {
		seen.add(actor);
		yield actor;
	}
	for (const scene of (game.scenes ?? []) as Iterable<Scene>) {
		for (const token of scene.tokens as Iterable<TokenDocument>) {
			if (token.actorLink) continue;
			const actor = token.actor as Actor | null;
			if (!actor || seen.has(actor)) continue;
			seen.add(actor);
			yield actor;
		}
	}
}

/** The effects on actors that end at `check`. */
export function effectsEndingAt(check: LastsUntilCheck, combat?: Combat | null): ActiveEffect[] {
	const found: ActiveEffect[] = [];
	for (const actor of everyActor()) {
		for (const effect of actor.effects as Iterable<ActiveEffect>) {
			if (effectEndsAt(effect, check, combat)) found.push(effect);
		}
	}
	return found;
}

function sourceNameOf(effect: ActiveEffect): string {
	if (effect.parent instanceof Item) return effect.parent.name ?? '';
	if (!effect.origin) return '';
	const origin = fromUuidSync(effect.origin as Parameters<typeof fromUuidSync>[0], {
		strict: false,
	}) as { name?: string } | null;
	return origin?.name ?? sourceOf(effect)?.name ?? '';
}

/** What an ended line keeps of the effect, so Undo can put it back. */
export function endedEffectRow(effect: ActiveEffect): EndedEffectRow {
	const holder = effect.parent as Actor;
	return {
		effectId: effect.id ?? '',
		holderUuid: holder.uuid ?? '',
		holderName: holder.name ?? '',
		name: effect.name ?? '',
		img: (effect.img as string | null) ?? '',
		sourceName: sourceNameOf(effect),
		effect: effect.toObject() as Record<string, unknown>,
	};
}

/** The moment that ended the effect, read by its holder, with the creature that put it on. */
function endedByOf(effect: ActiveEffect, moment: EndMoment): CardEventLastsUntil | undefined {
	const found = moment.endedBy?.[effect.uuid ?? ''];
	if (!found) return undefined;
	const source = sourceOf(effect);
	const holder = effect.parent as Actor;
	const named = source && source !== holder && source.uuid !== holder.uuid ? source.name : null;
	return { lastsUntil: found, ...(named ? { source: named } : {}) };
}

/**
 * The lines go on the host card when there is one, else on the card of the moment. That card keeps
 * the readers of a whispered host card. The first line can take the place of a waiting line.
 */
async function postEnded(moment: EndMoment, events: CardEvent[]): Promise<boolean> {
	const host = moment.hostId ? game.messages?.get(moment.hostId) : null;
	if (host && moment.replaces && canHost(host as never)) {
		const [first, ...rest] = events;
		if (await replaceCardEvent(host as never, moment.replaces.eventId, first)) {
			return rest.length < 1 || addCardEvents(host as never, rest);
		}
	}
	if (host && canHost(host as never) && (await addCardEvents(host as never, events))) return true;
	const key = moment.key ?? `once:${foundry.utils.randomID()}`;
	const hostReaders = ((host as { whisper?: string[] } | null)?.whisper ?? []).filter(Boolean);
	const whisper = moment.whisper ?? (hostReaders.length > 0 ? hostReaders : undefined);
	return addMomentEvents({ key, heading: moment.heading }, events, {
		...(whisper ? { whisper } : {}),
	});
}

/** On the active GM: delete the effects, then add a line each to the card of the moment. */
async function endHere(effects: ActiveEffect[], moment: EndMoment): Promise<void> {
	const live = effects.filter((effect) => {
		const holder = effect.parent as Actor | null;
		const uuid = effect.uuid ?? '';
		return !!effect.id && !ending.has(uuid) && !!holder?.effects.get(effect.id);
	});
	if (live.length < 1) return;
	for (const effect of live) ending.add(effect.uuid ?? '');
	try {
		const at = moment.replaces?.at ?? Date.now();
		const lines = live.map((effect) =>
			endedEffectEvent(endedEffectRow(effect), at, moment.reason, endedByOf(effect, moment)),
		);
		// With Feature Effects on, the delete empties the pools (emptyPoolsAtEnd).
		const automated = isRuleAutomationEnabled();
		const poolLines = automated ? [] : emptyPoolEvents(live, Date.now());
		const byHolder = new Map<Actor, string[]>();
		for (const effect of live) {
			const holder = effect.parent as Actor;
			byHolder.set(holder, [...(byHolder.get(holder) ?? []), effect.id as string]);
		}
		for (const [holder, ids] of byHolder) {
			if (automated) await holder.deleteEmbeddedDocuments('ActiveEffect', ids);
			else {
				await holder.deleteEmbeddedDocuments('ActiveEffect', ids, {
					[END_LINES_OPTION]: true,
				} as never);
			}
		}
		await postEnded(moment, [...lines, ...poolLines]);
	} finally {
		for (const effect of live) ending.delete(effect.uuid ?? '');
	}
}

function withEndedBy(effects: ActiveEffect[], moment: EndMoment, at?: EndCheck): EndMoment {
	if (!at) return moment;
	const endedBy: Record<string, Moment> = { ...moment.endedBy };
	for (const effect of effects) {
		const found = endingMoment(effect, at.check, at.combat);
		if (found && effect.uuid) endedBy[effect.uuid] = found;
	}
	return Object.keys(endedBy).length > 0 ? { ...moment, endedBy } : moment;
}

/**
 * End `effects` for one moment. The active GM deletes them and writes the
 * lines; another client asks the active GM. With no GM online, nothing ends.
 * With `at`, each line says which Lasts Until moment ended its effect.
 * Whether the active GM took the ends: false with no GM, or when they failed.
 */
export async function endEffects(
	effects: ActiveEffect[],
	endMoment: EndMoment,
	at?: EndCheck,
): Promise<boolean> {
	if (effects.length < 1) return true;
	try {
		const moment = withEndedBy(effects, endMoment, at);
		if (game.user?.isActiveGM) {
			await queue.run('end', () => endHere(effects, moment));
			return true;
		}
		const gm = (game.users as unknown as { activeGM?: { query(n: string, d: object): unknown } })
			.activeGM;
		if (!gm) return false;
		return !!(await gm.query(QUERY_NAME, { uuids: effects.map((effect) => effect.uuid), moment }));
	} catch (error) {
		console.error('Nimble | Could not end the Timed Effects of a moment.', error);
		return false;
	}
}

/**
 * End what `check` ends, on the card of that moment, and count its turn for the effects that stay.
 * What ends is read when the check happens, from the combat as it is then. The counts and ends go
 * one check at a time, so the next check counts from the counts of this one.
 */
export function endEffectsAt(
	check: LastsUntilCheck,
	moment: EndMoment,
	combat?: Combat | null,
): Promise<void> {
	const ending = effectsEndingAt(check, combat);
	return queue.run('at', async () => {
		await countMoments(check, combat, new Set(ending));
		if (isRuleAutomationEnabled()) await endEffects(ending, moment, { check, combat });
		else await waitEndEffects(ending, moment, { check, combat }, { once: true });
	});
}

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

const waitsAlready = (effect: ActiveEffect, key: string) =>
	!!(
		(effect.flags as Record<string, Record<string, unknown> | undefined> | undefined)?.[
			SYSTEM_ID
		]?.[END_WAITS_FLAG] as Record<string, unknown> | undefined
	)?.[key];

/**
 * Feature Effects off: what a moment reached does not end. Each effect gets a waiting line with
 * End where its ended line would go. `once`: a one-time moment (a turn, a round, a time), which
 * gives an effect its line once for each of its ends; an event gives a line each time. A string
 * names the moment when no check reached it. Whether the lines were placed.
 */
export async function waitEndEffects(
	effects: ActiveEffect[],
	endMoment: EndMoment,
	at?: EndCheck,
	{ once = false }: { once?: boolean | string } = {},
): Promise<boolean> {
	const onceKey = (effect: ActiveEffect) => {
		if (typeof once === 'string') return once;
		return at ? reachedEndKey(effect, at.check, at.combat) : 'moment';
	};
	const live = effects.filter((effect) => {
		const holder = effect.parent as Actor | null;
		if (!effect.id || !holder?.effects.get(effect.id)) return false;
		return !once || !waitsAlready(effect, onceKey(effect));
	});
	if (live.length < 1) return true;
	try {
		// A line with no host keeps the key of its card, so End can put the ended line there.
		const keyed =
			endMoment.key || endMoment.hostId
				? endMoment
				: { ...endMoment, key: `once:${foundry.utils.randomID()}` };
		const moment = withEndedBy(live, keyed, at);
		const now = Date.now();
		const lines = live.map((effect) => waitingEndLine(effect, moment, { at: now }));
		if (!(await postEnded(moment, lines))) return false;
		if (once) {
			for (const effect of live) {
				const path = `flags.${SYSTEM_ID}.${END_WAITS_FLAG}.${onceKey(effect)}`;
				await effect.update({ [path]: true } as never);
			}
		}
		return true;
	} catch (error) {
		console.error('Nimble | Could not post the waiting ends of a moment.', error);
		return false;
	}
}

/**
 * A clock turn that a "2nd next turn" moment counts, or a combat end that a "2nd combat ends"
 * moment counts, goes on its count when it does not end the effect.
 */
async function countMoments(
	check: LastsUntilCheck,
	combat: Combat | null | undefined,
	ending: ReadonlySet<ActiveEffect>,
): Promise<void> {
	if (check.type !== 'turnStart' && check.type !== 'turnEnd' && check.type !== 'combatEnd') return;
	for (const actor of everyActor()) {
		for (const effect of actor.effects as Iterable<ActiveEffect>) {
			if (ending.has(effect)) continue;
			const seen = turnsSeenAfter(effect, check, combat);
			if (seen) await effect.update({ [`flags.${SYSTEM_ID}.turnsSeen`]: seen } as never);
		}
	}
}

export function registerEndTimedEffectsQuery(): void {
	Hooks.once('init', () => {
		const queries = CONFIG.queries as unknown as Record<string, (data: never) => Promise<boolean>>;
		queries[QUERY_NAME] = async (data: { uuids?: string[]; moment: EndMoment }) => {
			const effects = (data.uuids ?? [])
				.map((uuid) => fromUuidSync(uuid as Parameters<typeof fromUuidSync>[0], { strict: false }))
				.filter((effect): effect is ActiveEffect => effect instanceof ActiveEffect);
			await queue.run('end', () => endHere(effects, data.moment));
			return true;
		};
	});
}

/** A copy that is put back gives its waiting lines again. */
function withoutEndWaits(data: Record<string, unknown>): Record<string, unknown> {
	const copy = foundry.utils.deepClone(data);
	const flags = (copy.flags as Record<string, Record<string, unknown> | undefined> | undefined)?.[
		SYSTEM_ID
	];
	if (flags) delete flags[END_WAITS_FLAG];
	return copy;
}

/** Put an ended effect back from its row. The owner of the holder or a GM can do it. */
export async function undoEndedEffect(row: EndedEffectRow): Promise<boolean> {
	const holder = fromUuidSync(row.holderUuid as Parameters<typeof fromUuidSync>[0], {
		strict: false,
	}) as Actor | null;
	if (!holder || !(game.user?.isGM || holder.isOwner)) return false;
	if (holder.effects.get(row.effectId)) {
		ui.notifications?.info(
			localize('NIMBLE.lastsUntil.chat.alreadyOn', { effect: row.name, name: holder.name ?? '' }),
		);
		return true;
	}
	const created = await (
		ActiveEffect as unknown as {
			implementation: {
				create(data: object, operation: object): Promise<unknown>;
			};
		}
	).implementation.create(withoutEndWaits(row.effect), {
		parent: holder,
		keepId: true,
		[EFFECT_RECREATED_OPTION]: true,
	});
	return !!created;
}
