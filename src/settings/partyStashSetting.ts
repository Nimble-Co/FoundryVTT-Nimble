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

interface PartyHolder {
	name?: string | null;
	getFlag?(scope: string, key: string): unknown;
	setFlag?(scope: string, key: string, value: unknown): Promise<unknown>;
	testUserPermission?(user: unknown, permission: string | number): boolean;
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

/** The npc every player can edit. Absent until a GM has opened the world once. */
export function findPartyHolder(): PartyHolder | null {
	return partyHolders().find((actor) => actor.getFlag?.(SYSTEM_ID, HOLDER_FLAG) === true) ?? null;
}

export function canWritePartyStash(user: { isGM?: boolean } | null | undefined): boolean {
	if (user?.isGM) return true;
	const holder = findPartyHolder();
	if (!holder || !user) return false;
	const level =
		(globalThis as { CONST?: { DOCUMENT_OWNERSHIP_LEVELS?: { OWNER?: number } } }).CONST
			?.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3;
	return Boolean(holder.testUserPermission?.(user, level));
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

/** Creates the shared actor and copies the world setting into it. A GM has to do this once. */
export async function ensurePartyStashHolder(): Promise<void> {
	if (game.user?.isGM !== true || findPartyHolder()) return;
	const ownership = {
		default:
			(globalThis as { CONST?: { DOCUMENT_OWNERSHIP_LEVELS?: { OWNER?: number } } }).CONST
				?.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3,
	};
	await Actor.create({
		name: 'Party Inventory',
		type: 'npc',
		ownership,
		flags: {
			[SYSTEM_ID]: {
				[HOLDER_FLAG]: true,
				[STASH_FLAG]: readSetting(),
			},
		},
	} as unknown as Actor.CreateData);
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
