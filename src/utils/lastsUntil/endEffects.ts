import { SYSTEM_ID } from '#system';
import { keyedQueue } from '../keyedQueue.js';
import localize from '../localize.js';
import { effectEndsAt } from './effectEndsAt.js';
import { sourceOf } from './effectSubject.js';
import type { LastsUntilCheck } from './momentReached.js';

const QUERY_NAME = `${SYSTEM_ID}.endTimedEffects`;

/** One row of the message: what ended, on whom, and the data to make it again. */
export interface EndedEffectRow {
	effectId: string;
	holderUuid: string;
	holderName: string;
	name: string;
	img: string;
	sourceName: string;
	effect: Record<string, unknown>;
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

function rowOf(effect: ActiveEffect): EndedEffectRow {
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

async function postEndedMessage(heading: string, rows: EndedEffectRow[]): Promise<void> {
	const chatData = {
		author: game.user?.id,
		speaker: { alias: game.user?.name ?? '' },
		type: 'effectsEnded',
		system: {
			actorName: game.user?.name ?? '',
			actorType: '',
			image: '',
			permissions: 0,
			rollMode: 0,
			heading,
			rows,
		},
	};
	await ChatMessage.create(chatData as unknown as ChatMessage.CreateData);
}

/** On the active GM: delete the effects, then post one message for the moment. */
async function endHere(effects: ActiveEffect[], heading: string): Promise<void> {
	const live = effects.filter((effect) => {
		const holder = effect.parent as Actor | null;
		const uuid = effect.uuid ?? '';
		return !!effect.id && !ending.has(uuid) && !!holder?.effects.get(effect.id);
	});
	if (live.length < 1) return;
	for (const effect of live) ending.add(effect.uuid ?? '');
	try {
		const rows = live.map(rowOf);
		const byHolder = new Map<Actor, string[]>();
		for (const effect of live) {
			const holder = effect.parent as Actor;
			byHolder.set(holder, [...(byHolder.get(holder) ?? []), effect.id as string]);
		}
		for (const [holder, ids] of byHolder) {
			await holder.deleteEmbeddedDocuments('ActiveEffect', ids);
		}
		await postEndedMessage(heading, rows);
	} finally {
		for (const effect of live) ending.delete(effect.uuid ?? '');
	}
}

/**
 * End `effects` for one moment. The active GM deletes them and posts the
 * message; another client asks the active GM. With no GM online, nothing ends.
 */
export function endEffects(effects: ActiveEffect[], heading: string): Promise<void> {
	if (effects.length < 1) return Promise.resolve();
	if (game.user?.isActiveGM) return queue.run('end', () => endHere(effects, heading));
	const gm = (game.users as unknown as { activeGM?: { query(n: string, d: object): unknown } })
		.activeGM;
	if (!gm) return Promise.resolve();
	return Promise.resolve(
		gm.query(QUERY_NAME, { uuids: effects.map((effect) => effect.uuid), heading }),
	).then(() => undefined);
}

/** End what `check` ends, with the message heading of that moment. */
export function endEffectsAt(
	check: LastsUntilCheck,
	heading: string,
	combat?: Combat | null,
): Promise<void> {
	return endEffects(effectsEndingAt(check, combat), heading);
}

export function registerEndTimedEffectsQuery(): void {
	Hooks.once('init', () => {
		const queries = CONFIG.queries as unknown as Record<string, (data: never) => Promise<boolean>>;
		queries[QUERY_NAME] = async (data: { uuids?: string[]; heading?: string }) => {
			const effects = (data.uuids ?? [])
				.map((uuid) => fromUuidSync(uuid as Parameters<typeof fromUuidSync>[0], { strict: false }))
				.filter((effect): effect is ActiveEffect => effect instanceof ActiveEffect);
			await queue.run('end', () => endHere(effects, data.heading ?? ''));
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
	).implementation.create(row.effect, { parent: holder, keepId: true });
	return !!created;
}
