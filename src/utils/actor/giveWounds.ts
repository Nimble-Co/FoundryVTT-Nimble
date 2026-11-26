import { SYSTEM_ID } from '#system';
import { askActiveGm } from '#utils/askActiveGm.js';
import {
	alterPendingWound,
	type PendingWoundOffer,
	type WoundCause,
	type WoundSource,
} from '#utils/wounds/pendingWound.js';
import type { WoundCreature } from '#utils/wounds/rulesWatching.js';
import { ACTOR_WOUNDS_PATHS } from './actorHpChangePaths.js';
import { getActorWoundsValueAndMax } from './actorResources.js';

const QUERY_NAME = `${SYSTEM_ID}.giveWounds`;

/** What a Wound step did to one creature: its track before and after, or that it has no track. */
export type WoundRecord =
	| { actorName: string; before: number; after: number }
	| { actorName: string; noTrack: true };

interface WoundHolder extends WoundCreature {
	uuid: string | null;
	isOwner?: boolean;
	system?: unknown;
	update(data: Record<string, unknown>): Promise<unknown>;
}

export interface GiveWoundsOptions {
	source?: WoundSource | null;
	cause?: WoundCause;
	critical?: boolean;
	seen?: ReadonlySet<string>;
	choose?: (offer: PendingWoundOffer) => Promise<boolean>;
	watchers?: readonly WoundCreature[];
}

interface GiveWoundsQuery {
	actorUuid: string;
	amount: number;
	source?: Pick<WoundSource, 'uuid' | 'name'> | null;
	cause?: WoundCause;
	critical?: boolean;
	seen?: string[];
}

function queryData(
	actorUuid: string,
	amount: number,
	options?: GiveWoundsOptions,
): GiveWoundsQuery {
	const data: GiveWoundsQuery = { actorUuid, amount };
	if (!options) return data;
	if (options.source) {
		data.source = { uuid: options.source.uuid ?? null, name: options.source.name ?? null };
	}
	if (options.cause) data.cause = options.cause;
	if (options.critical) data.critical = true;
	if (options.seen && options.seen.size > 0) data.seen = [...options.seen];
	return data;
}

async function giveWoundsHere(
	actor: WoundHolder,
	amount: number,
	options?: GiveWoundsOptions,
): Promise<WoundRecord> {
	const actorName = actor.name ?? '';
	const wounds = getActorWoundsValueAndMax(actor as never);
	if (!wounds) return { actorName, noTrack: true };

	const outcome = await alterPendingWound({
		actor,
		amount,
		cause: options?.cause ?? 'direct',
		critical: options?.critical,
		source: options?.source ?? null,
		seen: options?.seen,
		choose: options?.choose,
		watchers: options?.watchers,
	});

	const land = Math.min(outcome.land, Math.max(0, wounds.max - wounds.value));
	const after = wounds.value + (land >= 1 ? land : 0);
	if (after !== wounds.value) await actor.update({ [ACTOR_WOUNDS_PATHS.value]: after });

	for (const redirect of outcome.redirects) {
		const target = redirect.actor as WoundHolder;
		if (!target.uuid || typeof target.update !== 'function') continue;
		await giveWounds(target, redirect.amount, {
			cause: 'redirect',
			source: options?.source ?? null,
			critical: options?.critical,
			seen: outcome.seen,
			choose: options?.choose,
			watchers: options?.watchers,
		});
	}

	return { actorName, before: wounds.value, after };
}

function isRecord(answer: unknown): answer is WoundRecord {
	return typeof (answer as WoundRecord | null)?.actorName === 'string';
}

/**
 * Gives the creature `amount` Wounds, up to the max of its track, after anything
 * that can stop, lower, or redirect them. The owner writes it; any other user
 * asks the active GM, who asks about an optional rule. Null: nothing to give,
 * or no GM took the request. A voluntary Wound cost does not come through here.
 */
export async function giveWounds(
	actor: WoundHolder,
	amount: number,
	options?: GiveWoundsOptions,
): Promise<WoundRecord | null> {
	const count = Math.floor(amount);
	if (!(count >= 1)) return null;
	if (actor.isOwner || !getActorWoundsValueAndMax(actor as never)) {
		return giveWoundsHere(actor, count, options);
	}
	if (!actor.uuid) return null;
	const answer = await askActiveGm(QUERY_NAME, queryData(actor.uuid, count, options));
	return isRecord(answer) ? answer : null;
}

/** The Wounds that a gain gave: none for a creature with no track or a full one. */
export function woundsGiven(record: WoundRecord | null): number {
	return record && !('noTrack' in record) ? record.after - record.before : 0;
}

/** Takes up to `amount` Wounds off a creature the user owns, never below 0. Healing does not ask the pending-Wound rules. */
export async function takeBackWounds(actor: WoundHolder, amount: number): Promise<void> {
	const wounds = getActorWoundsValueAndMax(actor as never);
	if (!wounds || !actor.isOwner || !(amount > 0)) return;
	const after = Math.max(0, wounds.value - amount);
	if (after !== wounds.value) await actor.update({ [ACTOR_WOUNDS_PATHS.value]: after });
}

export function registerGiveWoundsQuery(): void {
	Hooks.once('init', () => {
		const queries = CONFIG.queries as unknown as Record<string, (data: never) => Promise<unknown>>;
		queries[QUERY_NAME] = async (data: GiveWoundsQuery) => {
			const actor = (await fromUuid(data.actorUuid as never)) as WoundHolder | null;
			if (!actor) return null;
			return giveWoundsHere(actor, Math.floor(data.amount), {
				source: data.source ?? null,
				cause: data.cause,
				critical: data.critical === true,
				seen: new Set(data.seen ?? []),
			});
		};
	});
}
