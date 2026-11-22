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

/** The world setting, or an empty stash when it has never been written. */
export function readPartyStash(): PartyStash {
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
	await game.settings.set(SYSTEM_ID as 'core', PARTY_STASH_SETTING as 'rollMode', stash as never);
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
}
