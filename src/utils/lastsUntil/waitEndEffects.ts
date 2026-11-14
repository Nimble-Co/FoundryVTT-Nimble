import { SYSTEM_ID } from '#system';
import { reachedEndKey } from '#utils/lastsUntil/effectEndsAt.js';
import {
	type EndCheck,
	type EndMoment,
	postEnded,
	withEndedBy,
} from '#utils/lastsUntil/endLines.js';
import { waitingEndLine } from '#utils/lastsUntil/waitingEndLine.js';

export interface WaitOptions {
	/** A one-time moment; a string names it when no check reached it. */
	once?: boolean | string;
}

/** On an effect: the one-time moments (`reachedEndKey`) that gave their waiting line. */
const END_WAITS_FLAG = 'endWaits';

/** A copy that is put back gives its waiting lines again. */
export function withoutEndWaits(data: Record<string, unknown>): Record<string, unknown> {
	const copy = foundry.utils.deepClone(data);
	const flags = (copy.flags as Record<string, Record<string, unknown> | undefined> | undefined)?.[
		SYSTEM_ID
	];
	if (flags) delete flags[END_WAITS_FLAG];
	return copy;
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
 * names the moment when no check reached it.
 */
export async function waitEndEffects(
	effects: ActiveEffect[],
	endMoment: EndMoment,
	at?: EndCheck,
	{ once = false }: WaitOptions = {},
): Promise<void> {
	const onceKey = (effect: ActiveEffect) => {
		if (typeof once === 'string') return once;
		return at ? reachedEndKey(effect, at.check, at.combat) : 'moment';
	};
	const live = effects.filter((effect) => {
		const holder = effect.parent as Actor | null;
		if (!effect.id || !holder?.effects.get(effect.id)) return false;
		return !once || !waitsAlready(effect, onceKey(effect));
	});
	if (live.length < 1) return;
	try {
		// A line with no host keeps the key of its card, so End can put the ended line there.
		const keyed =
			endMoment.key || endMoment.hostId
				? endMoment
				: { ...endMoment, key: `once:${foundry.utils.randomID()}` };
		const moment = withEndedBy(live, keyed, at);
		const now = Date.now();
		const lines = live.map((effect) => waitingEndLine(effect, moment, { at: now }));
		if (!(await postEnded(moment, lines))) return;
		if (once) {
			for (const effect of live) {
				const path = `flags.${SYSTEM_ID}.${END_WAITS_FLAG}.${onceKey(effect)}`;
				await effect.update({ [path]: true } as never);
			}
		}
	} catch (error) {
		console.error('Nimble | Could not post the waiting ends of a moment.', error);
	}
}
