import { SYSTEM_ID } from '#system';
import type { CardEventLastsUntil, CardEventText, EndedEffectRow } from '#types/cardEvent.d.ts';
import { EFFECT_RECREATED_OPTION } from '#utils/actor/applyConditionToActor.js';
import { addCardEvents, addMomentEvents, canHost } from '#utils/chat/cardEvents.js';
import { keyedQueue } from '#utils/keyedQueue.js';
import { effectEndsAt, endingMoment, turnsSeenAfter } from '#utils/lastsUntil/effectEndsAt.js';
import { sourceOf } from '#utils/lastsUntil/effectSubject.js';
import { endedEffectEvent } from '#utils/lastsUntil/endedEffectEvent.js';
import type { LastsUntilCheck, Moment } from '#utils/lastsUntil/momentReached.js';
import localize from '#utils/localize.js';

const QUERY_NAME = `${SYSTEM_ID}.endTimedEffects`;

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

interface EndedLine {
	row: EndedEffectRow;
	endedBy?: CardEventLastsUntil;
}

/**
 * The lines go on the host card when there is one, else on the card of the moment. That card keeps
 * the readers of a whispered host card.
 */
async function postEnded(moment: EndMoment, lines: EndedLine[]): Promise<boolean> {
	const at = Date.now();
	const events = lines.map(({ row, endedBy }) => endedEffectEvent(row, at, moment.reason, endedBy));
	const host = moment.hostId ? game.messages?.get(moment.hostId) : null;
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
		const lines = live.map((effect) => ({
			row: endedEffectRow(effect),
			endedBy: endedByOf(effect, moment),
		}));
		const byHolder = new Map<Actor, string[]>();
		for (const effect of live) {
			const holder = effect.parent as Actor;
			byHolder.set(holder, [...(byHolder.get(holder) ?? []), effect.id as string]);
		}
		for (const [holder, ids] of byHolder) {
			await holder.deleteEmbeddedDocuments('ActiveEffect', ids);
		}
		await postEnded(moment, lines);
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
 */
export async function endEffects(
	effects: ActiveEffect[],
	endMoment: EndMoment,
	at?: EndCheck,
): Promise<void> {
	if (effects.length < 1) return;
	try {
		const moment = withEndedBy(effects, endMoment, at);
		if (game.user?.isActiveGM) {
			await queue.run('end', () => endHere(effects, moment));
			return;
		}
		const gm = (game.users as unknown as { activeGM?: { query(n: string, d: object): unknown } })
			.activeGM;
		await gm?.query(QUERY_NAME, { uuids: effects.map((effect) => effect.uuid), moment });
	} catch (error) {
		console.error('Nimble | Could not end the Timed Effects of a moment.', error);
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
		await countTurns(check, combat, new Set(ending));
		await endEffects(ending, moment, { check, combat });
	});
}

/** A clock turn that a "2nd next turn" moment counts, and that does not end it, goes on its count. */
async function countTurns(
	check: LastsUntilCheck,
	combat: Combat | null | undefined,
	ending: ReadonlySet<ActiveEffect>,
): Promise<void> {
	if (check.type !== 'turnStart' && check.type !== 'turnEnd') return;
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
	).implementation.create(row.effect, {
		parent: holder,
		keepId: true,
		[EFFECT_RECREATED_OPTION]: true,
	});
	return !!created;
}
