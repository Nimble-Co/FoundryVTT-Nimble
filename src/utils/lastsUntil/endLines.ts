import type { CardEvent, CardEventLastsUntil, WaitingEndMoment } from '#types/cardEvent.d.ts';
import {
	addCardEvents,
	addMomentEvents,
	canHost,
	replaceCardEvent,
} from '#utils/chat/cardEvents.js';
import { endingMoment } from '#utils/lastsUntil/effectEndsAt.js';
import { sourceOf } from '#utils/lastsUntil/effectSubject.js';
import type { LastsUntilCheck, Moment } from '#utils/lastsUntil/momentReached.js';

/** The moment that ends the effects: its card and why they ended. */
export interface EndMoment extends WaitingEndMoment {
	/** The Lasts Until moment that ended each effect, by effect UUID. */
	endedBy?: Record<string, Moment>;
	/** The waiting line on the host card that the ended line takes the place of, with its time. */
	replaces?: { eventId: string; at: number };
}

/** Where the check happened: the moments it reached are read here, before the effects go. */
export interface EndCheck {
	check: LastsUntilCheck;
	combat?: Combat | null;
}

/** The name of the item or creature an effect came from. */
export function sourceNameOf(effect: ActiveEffect): string {
	if (effect.parent instanceof Item) return effect.parent.name ?? '';
	if (!effect.origin) return '';
	const origin = fromUuidSync(effect.origin as Parameters<typeof fromUuidSync>[0], {
		strict: false,
	}) as { name?: string } | null;
	return origin?.name ?? sourceOf(effect)?.name ?? '';
}

/** The moment that ended the effect, read by its holder, with the creature that put it on. */
export function endedByOf(
	effect: ActiveEffect,
	moment: EndMoment,
): CardEventLastsUntil | undefined {
	const found = moment.endedBy?.[effect.uuid ?? ''];
	if (!found) return undefined;
	const source = sourceOf(effect);
	const holder = effect.parent as Actor;
	const named = source && source !== holder && source.uuid !== holder.uuid ? source.name : null;
	return { lastsUntil: found, ...(named ? { source: named } : {}) };
}

/** The moment with the Lasts Until moment that `at` reached for each effect. */
export function withEndedBy(effects: ActiveEffect[], moment: EndMoment, at?: EndCheck): EndMoment {
	if (!at) return moment;
	const endedBy: Record<string, Moment> = { ...moment.endedBy };
	for (const effect of effects) {
		const found = endingMoment(effect, at.check, at.combat);
		if (found && effect.uuid) endedBy[effect.uuid] = found;
	}
	return Object.keys(endedBy).length > 0 ? { ...moment, endedBy } : moment;
}

/**
 * The lines go on the host card when there is one, else on the card of the moment. That card keeps
 * the readers of a whispered host card. The first line can take the place of a waiting line.
 */
export async function postEnded(moment: EndMoment, events: CardEvent[]): Promise<boolean> {
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
