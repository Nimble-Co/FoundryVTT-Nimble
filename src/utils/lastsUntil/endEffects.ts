import { SYSTEM_ID } from '#system';
import type { EndedEffectRow } from '#types/cardEvent.d.ts';
import { EFFECT_RECREATED_OPTION } from '#utils/actor/applyConditionToActor.js';
import { END_LINES_OPTION, emptyPoolEvents } from '#utils/dicePool/emptyPoolLine.js';
import { keyedQueue } from '#utils/keyedQueue.js';
import { effectEndsAt } from '#utils/lastsUntil/effectEndsAt.js';
import { endedEffectEvent } from '#utils/lastsUntil/endedEffectEvent.js';
import {
	type EndCheck,
	type EndMoment,
	endedByOf,
	postEnded,
	sourceNameOf,
	withEndedBy,
} from '#utils/lastsUntil/endLines.js';
import type { LastsUntilCheck } from '#utils/lastsUntil/momentReached.js';
import { withoutEndWaits } from '#utils/lastsUntil/waitEndEffects.js';
import localize from '#utils/localize.js';
import { isRuleAutomationEnabled } from '../../settings/automationSettings.js';

const QUERY_NAME = `${SYSTEM_ID}.endTimedEffects`;

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
	).implementation.create(withoutEndWaits(row.effect), {
		parent: holder,
		keepId: true,
		[EFFECT_RECREATED_OPTION]: true,
	});
	return !!created;
}
