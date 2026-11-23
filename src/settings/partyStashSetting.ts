import { SYSTEM_ID, systemHookName } from '#system';
import type { TransferItem } from '#utils/partyStash/planItemTransfer.ts';

export const PARTY_STASH_SETTING = 'partyStash';

/** Fired on every client after the party stash is saved. Sheets redraw from it. */
export const PARTY_STASH_HOOK = systemHookName('partyStash');

export interface PartyCurrency {
	gp: number;
	sp: number;
	cp: number;
}

export interface PartyStash {
	currency: PartyCurrency;
	items: TransferItem[];
}

const COINS = ['gp', 'sp', 'cp'] as const;
const HOLDER_FLAG = 'partyStashHolder';
const STASH_FLAG = 'partyStash';
const PARTY_INVENTORY_TYPE = 'partyInventory';
export const PARTY_INVENTORY_NAME = 'Party Inventory';

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

export function emptyPartyStash(): PartyStash {
	return { currency: { gp: 0, sp: 0, cp: 0 }, items: [] };
}

function coinValue(value: unknown): number {
	const number = Math.floor(Number(value));
	return Number.isFinite(number) && number > 0 ? number : 0;
}

function isStoredItem(value: unknown): value is TransferItem {
	if (!value || typeof value !== 'object') return false;
	const item = value as { _id?: unknown; type?: unknown };
	return typeof item._id === 'string' && item._id.length > 0 && item.type === 'object';
}

function partyHolders(): PartyHolder[] {
	const actors = game.actors as Iterable<PartyHolder> | undefined;
	return actors ? [...actors] : [];
}

function isPartyStashHolder(actor: PartyHolder): boolean {
	return actor.getFlag?.(SYSTEM_ID, HOLDER_FLAG) === true;
}

/** The party inventory actor every player can edit. Absent until a GM has opened the world once. */
export function findPartyHolder(): PartyHolder | null {
	return partyHolders().find(isPartyStashHolder) ?? null;
}

interface ActorDirectoryCollection {
	_getVisibleTreeContents(): PartyHolder[];
	initializeTree(): void;
}

/** The holder is an actor every player owns, so Foundry would list it. Leave it out of the Actors sidebar. */
export function hidePartyStashHolder(): void {
	const actors = game.actors as unknown as ActorDirectoryCollection | undefined;
	if (!actors?._getVisibleTreeContents) return;
	const listVisibleActors = actors._getVisibleTreeContents.bind(actors);
	actors._getVisibleTreeContents = () =>
		listVisibleActors().filter((actor) => !isPartyStashHolder(actor));
	actors.initializeTree();
}

export function canWritePartyStash(user: { isGM?: boolean } | null | undefined): boolean {
	if (user?.isGM) return true;
	const holder = findPartyHolder();
	if (!holder || !user) return false;
	return Boolean(holder.testUserPermission?.(user, ownerLevel()));
}

function readSetting(): PartyStash {
	try {
		const settings = game.settings;
		if (!settings?.get) return emptyPartyStash();
		return normalizePartyStash(
			settings.get(SYSTEM_ID as 'core', PARTY_STASH_SETTING as 'rollMode'),
		);
	} catch {
		return emptyPartyStash();
	}
}

/** The shared stash. The holder actor wins once it exists, so players can write it. */
export function readPartyStash(): PartyStash {
	const holder = findPartyHolder();
	if (holder?.getFlag) return normalizePartyStash(holder.getFlag(SYSTEM_ID, STASH_FLAG));
	return readSetting();
}

export function normalizePartyStash(raw: unknown): PartyStash {
	const data = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
	const currency =
		data.currency && typeof data.currency === 'object'
			? (data.currency as Record<string, unknown>)
			: {};
	const items = Array.isArray(data.items) ? data.items.filter(isStoredItem) : [];
	return {
		currency: {
			gp: coinValue(currency.gp),
			sp: coinValue(currency.sp),
			cp: coinValue(currency.cp),
		},
		items,
	};
}

export async function writePartyStash(stash: PartyStash): Promise<void> {
	const holder = findPartyHolder();
	if (holder?.setFlag) {
		await holder.setFlag(SYSTEM_ID, STASH_FLAG, stash);
		// @ts-expect-error Custom hook
		Hooks.callAll(PARTY_STASH_HOOK);
		return;
	}
	await game.settings.set(SYSTEM_ID as 'core', PARTY_STASH_SETTING as 'rollMode', stash as never);
}

function ownerLevel(): number {
	return (
		(globalThis as { CONST?: { DOCUMENT_OWNERSHIP_LEVELS?: { OWNER?: number } } }).CONST
			?.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3
	);
}

function partyInventoryName() {
	return { name: PARTY_INVENTORY_NAME };
}

/** The document to create for a missing holder, or for one that is still a creature. */
export function partyInventoryReplacement(
	holder: Pick<PartyHolder, 'type' | 'ownership' | 'getFlag'> | null,
	fallback: PartyStash,
	ownership: PartyOwnership,
) {
	if (holder?.type === PARTY_INVENTORY_TYPE) return null;
	const stash = holder ? normalizePartyStash(holder.getFlag?.(SYSTEM_ID, STASH_FLAG)) : fallback;
	const copied = holder?.ownership as { default?: number } | undefined;
	return {
		...partyInventoryName(),
		type: PARTY_INVENTORY_TYPE,
		ownership: typeof copied?.default === 'number' ? copied : ownership,
		flags: {
			[SYSTEM_ID]: {
				[HOLDER_FLAG]: true,
				[STASH_FLAG]: stash,
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
): ReturnType<typeof partyInventoryName> | null {
	if (holder?.type !== PARTY_INVENTORY_TYPE) return null;
	if (holder.name === PARTY_INVENTORY_NAME) return null;
	return partyInventoryName();
}

/** Creates the party inventory actor, or replaces a creature holder with one. A GM has to open the world once. */
export async function ensurePartyStashHolder(): Promise<void> {
	if (game.user?.isGM !== true) return;
	const holder = findPartyHolder();
	const data = partyInventoryReplacement(holder, readSetting(), { default: ownerLevel() });
	if (data) {
		const created = await Actor.create(data as unknown as Actor.CreateData);
		if (created && holder) await holder.delete?.();
		return;
	}
	const identity = partyInventoryIdentity(holder);
	if (identity) await holder?.update?.(identity);
}

export function partyCoin(coin: string): coin is (typeof COINS)[number] {
	return COINS.includes(coin as (typeof COINS)[number]);
}

export function registerPartyStashSetting(): void {
	game.settings.register(
		SYSTEM_ID as 'core',
		PARTY_STASH_SETTING as 'rollMode',
		{
			name: 'Party inventory',
			scope: 'world',
			config: false,
			type: Object,
			default: emptyPartyStash(),
			onChange: () => {
				// @ts-expect-error Custom hook
				Hooks.callAll(PARTY_STASH_HOOK);
			},
		} as unknown as Parameters<typeof game.settings.register>[2],
	);
	Hooks.on('updateActor', (actor: PartyHolder) => {
		if (actor.getFlag?.(SYSTEM_ID, HOLDER_FLAG) !== true) return;
		// @ts-expect-error Custom hook
		Hooks.callAll(PARTY_STASH_HOOK);
	});
}
