import { SYSTEM_ID } from '#system';
import type { ItemActivationManager } from '../../managers/ItemActivationManager.js';
import { askActiveGm } from '../askActiveGm.js';
import { isActiveGM } from '../isActiveGM.js';

const QUERY_NAME = `${SYSTEM_ID}.useItemForFree`;

interface IdentifiedItem {
	id: string | null;
	identifier?: string;
	system?: { identifier?: string };
}

interface FreeUser {
	uuid?: string | null;
	isOwner?: boolean;
	items: Iterable<IdentifiedItem>;
	activateItem(id: string, options: Record<string, unknown>): Promise<unknown>;
}

interface FreeUseRequest {
	actorUuid: string;
	itemIdentifier: string;
	free: ItemActivationManager.FreeUse;
}

function identifierOf(item: IdentifiedItem): string {
	return item.identifier || item.system?.identifier || '';
}

async function useHere(
	actor: FreeUser,
	itemIdentifier: string,
	free: ItemActivationManager.FreeUse,
): Promise<boolean> {
	const item = [...actor.items].find((each) => identifierOf(each) === itemIdentifier);
	if (!item?.id) return false;
	await actor.activateItem(item.id, { fastForward: true, free });
	return true;
}

/** A player who owns the actor uses it here, so the card is theirs and has their targets. */
function canUseHere(actor: FreeUser): boolean {
	if (isActiveGM()) return true;
	return actor.isOwner === true && game.user?.isGM !== true;
}

/**
 * The actor uses its item with this identifier, with no window, as `free` says. The active GM or a
 * player who owns the actor makes the use; another client asks the active GM.
 */
export async function useItemForFree(
	actor: FreeUser,
	itemIdentifier: string,
	free: ItemActivationManager.FreeUse,
): Promise<boolean> {
	if (canUseHere(actor)) return useHere(actor, itemIdentifier, free);
	if (!actor.uuid) return false;
	const request: FreeUseRequest = { actorUuid: actor.uuid, itemIdentifier, free };
	return (await askActiveGm(QUERY_NAME, request)) === true;
}

export function registerUseItemForFreeQuery(): void {
	Hooks.once('init', () => {
		const queries = CONFIG.queries as unknown as Record<string, (data: never) => Promise<unknown>>;
		queries[QUERY_NAME] = async (data: FreeUseRequest) => {
			const actor = (await fromUuid(data.actorUuid as never)) as FreeUser | null;
			if (!actor) return false;
			return useHere(actor, data.itemIdentifier, data.free);
		};
	});
}
