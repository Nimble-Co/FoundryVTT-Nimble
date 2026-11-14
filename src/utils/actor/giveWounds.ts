import { SYSTEM_ID } from '#system';
import { askActiveGm } from '#utils/askActiveGm.js';
import { ACTOR_WOUNDS_PATHS } from './actorHpChangePaths.js';
import { getActorWoundsValueAndMax } from './actorResources.js';

const QUERY_NAME = `${SYSTEM_ID}.giveWounds`;

/** What a Wound step did to one creature: its track before and after, or that it has no track. */
export type WoundRecord =
	| { actorName: string; before: number; after: number }
	| { actorName: string; noTrack: true };

interface WoundHolder {
	uuid: string;
	name?: string | null;
	isOwner?: boolean;
	system?: unknown;
	update(data: Record<string, unknown>): Promise<unknown>;
}

async function giveWoundsHere(actor: WoundHolder, amount: number): Promise<WoundRecord> {
	const actorName = actor.name ?? '';
	const wounds = getActorWoundsValueAndMax(actor as never);
	if (!wounds) return { actorName, noTrack: true };
	const after = Math.min(wounds.max, wounds.value + amount);
	if (after !== wounds.value) await actor.update({ [ACTOR_WOUNDS_PATHS.value]: after });
	return { actorName, before: wounds.value, after };
}

function isRecord(answer: unknown): answer is WoundRecord {
	return typeof (answer as WoundRecord | null)?.actorName === 'string';
}

/**
 * Gives the creature `amount` Wounds, up to the max of its track. The owner writes it; any other
 * user asks the active GM. Null: nothing to give, or no GM took the request.
 */
export async function giveWounds(actor: WoundHolder, amount: number): Promise<WoundRecord | null> {
	const count = Math.floor(amount);
	if (!(count >= 1)) return null;
	if (actor.isOwner || !getActorWoundsValueAndMax(actor as never)) {
		return giveWoundsHere(actor, count);
	}
	const answer = await askActiveGm(QUERY_NAME, { actorUuid: actor.uuid, amount: count });
	return isRecord(answer) ? answer : null;
}

/** The Wounds that a gain gave: none for a creature with no track or a full one. */
export function woundsGiven(record: WoundRecord | null): number {
	return record && !('noTrack' in record) ? record.after - record.before : 0;
}

/** Takes up to `amount` Wounds off a creature the user owns, never below 0. */
export async function takeBackWounds(actor: WoundHolder, amount: number): Promise<void> {
	const wounds = getActorWoundsValueAndMax(actor as never);
	if (!wounds || !actor.isOwner || !(amount > 0)) return;
	const after = Math.max(0, wounds.value - amount);
	if (after !== wounds.value) await actor.update({ [ACTOR_WOUNDS_PATHS.value]: after });
}

export function registerGiveWoundsQuery(): void {
	Hooks.once('init', () => {
		const queries = CONFIG.queries as unknown as Record<string, (data: never) => Promise<unknown>>;
		queries[QUERY_NAME] = async (data: { actorUuid: string; amount: number }) => {
			const actor = (await fromUuid(data.actorUuid as never)) as WoundHolder | null;
			if (!actor) return null;
			return giveWoundsHere(actor, Math.floor(data.amount));
		};
	});
}
