import { SYSTEM_ID } from '#system';
import localize from '#utils/localize.ts';
import {
	normalizePartyInventory,
	PARTY_INVENTORY_FLAG,
	PARTY_INVENTORY_HOLDER_FLAG,
	PARTY_INVENTORY_HOOK,
	type PartyInventory,
	readPartyInventorySetting,
	writePartyInventorySetting,
} from '../../settings/partyInventorySetting.ts';

const PARTY_INVENTORY_TYPE = 'partyInventory';
const PARTY_INVENTORY_NAME_KEY = 'NIMBLE.actorSheet.hero.inventory.party';

interface PartyOwnership {
	default: number;
}

interface PartyHolder {
	name?: string | null;
	type?: string;
	ownership?: object;
	getFlag?(scope: string, key: string): unknown;
	setFlag?(scope: string, key: string, value: unknown): Promise<unknown>;
	testUserPermission?(user: unknown, permission: string | number): boolean;
	update?(data: object): Promise<unknown>;
	delete?(): Promise<unknown>;
}

/** The name stored on the party inventory actor, in the language of this client. */
export function partyInventoryStoredName(): string {
	return localize(PARTY_INVENTORY_NAME_KEY);
}

function partyHolders(): PartyHolder[] {
	const actors = game.actors as Iterable<PartyHolder> | undefined;
	return actors ? [...actors] : [];
}

function isPartyInventoryHolder(actor: PartyHolder): boolean {
	return actor.getFlag?.(SYSTEM_ID, PARTY_INVENTORY_HOLDER_FLAG) === true;
}

/** The party inventory actor every player can edit. Absent until a GM has opened the world once. */
export function findPartyInventoryHolder(): PartyHolder | null {
	return partyHolders().find(isPartyInventoryHolder) ?? null;
}

interface ActorDirectoryCollection {
	_getVisibleTreeContents(): PartyHolder[];
	initializeTree(): void;
}

/** The holder is an actor every player owns, so Foundry would list it. Leave it out of the Actors sidebar. */
export function hidePartyInventoryHolder(): void {
	const actors = game.actors as unknown as ActorDirectoryCollection | undefined;
	if (!actors?._getVisibleTreeContents) return;
	const listVisibleActors = actors._getVisibleTreeContents.bind(actors);
	actors._getVisibleTreeContents = () =>
		listVisibleActors().filter((actor) => !isPartyInventoryHolder(actor));
	actors.initializeTree();
}

export function canWritePartyInventory(user: { isGM?: boolean } | null | undefined): boolean {
	if (user?.isGM) return true;
	const holder = findPartyInventoryHolder();
	if (!holder || !user) return false;
	return Boolean(holder.testUserPermission?.(user, ownerLevel()));
}

/** The shared list. The holder actor wins once it exists, so players can write it. */
export function readPartyInventory(): PartyInventory {
	const holder = findPartyInventoryHolder();
	if (holder?.getFlag) {
		return normalizePartyInventory(holder.getFlag(SYSTEM_ID, PARTY_INVENTORY_FLAG));
	}
	return readPartyInventorySetting();
}

export async function writePartyInventory(inventory: PartyInventory): Promise<void> {
	const holder = findPartyInventoryHolder();
	if (holder?.setFlag) {
		await holder.setFlag(SYSTEM_ID, PARTY_INVENTORY_FLAG, inventory);
		// @ts-expect-error Custom hook
		Hooks.callAll(PARTY_INVENTORY_HOOK);
		return;
	}
	await writePartyInventorySetting(inventory);
}

export function watchPartyInventoryHolder(): void {
	Hooks.on('updateActor', (actor: PartyHolder) => {
		if (actor.getFlag?.(SYSTEM_ID, PARTY_INVENTORY_HOLDER_FLAG) !== true) return;
		// @ts-expect-error Custom hook
		Hooks.callAll(PARTY_INVENTORY_HOOK);
	});
}

function ownerLevel(): number {
	return (
		(globalThis as { CONST?: { DOCUMENT_OWNERSHIP_LEVELS?: { OWNER?: number } } }).CONST
			?.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3
	);
}

/** The document to create for a missing holder, or for one that is still a creature. */
export function partyInventoryReplacement(
	holder: Pick<PartyHolder, 'type' | 'ownership' | 'getFlag'> | null,
	fallback: PartyInventory,
	ownership: PartyOwnership,
) {
	if (holder?.type === PARTY_INVENTORY_TYPE) return null;
	const inventory = holder
		? normalizePartyInventory(holder.getFlag?.(SYSTEM_ID, PARTY_INVENTORY_FLAG))
		: fallback;
	const copied = holder?.ownership as { default?: number } | undefined;
	return {
		name: partyInventoryStoredName(),
		type: PARTY_INVENTORY_TYPE,
		ownership: typeof copied?.default === 'number' ? copied : ownership,
		flags: {
			[SYSTEM_ID]: {
				[PARTY_INVENTORY_HOLDER_FLAG]: true,
				[PARTY_INVENTORY_FLAG]: inventory,
			},
		},
	};
}

/**
 * The party name for a holder that is already a party inventory.
 * Null when it already has that name, so a ready hook does not write every time.
 */
export function partyInventoryIdentity(
	holder: Pick<PartyHolder, 'type' | 'name'> | null,
): { name: string } | null {
	if (holder?.type !== PARTY_INVENTORY_TYPE) return null;
	const name = partyInventoryStoredName();
	if (holder.name === name) return null;
	return { name };
}

/** Creates the party inventory actor, or replaces a creature holder with one. A GM has to open the world once. */
export async function ensurePartyInventoryHolder(): Promise<void> {
	if (game.user?.isGM !== true) return;
	const holder = findPartyInventoryHolder();
	const data = partyInventoryReplacement(holder, readPartyInventorySetting(), {
		default: ownerLevel(),
	});
	if (data) {
		const created = await Actor.create(data as unknown as Actor.CreateData);
		if (created && holder) await holder.delete?.();
		return;
	}
	const identity = partyInventoryIdentity(holder);
	if (identity) await holder?.update?.(identity);
}
