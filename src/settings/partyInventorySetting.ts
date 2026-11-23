import { SYSTEM_ID, systemHookName } from '#system';
import type { TransferItem } from '#utils/partyInventory/planItemTransfer.ts';

export const PARTY_INVENTORY_SETTING = 'partyInventory';

/** Fired on every client after the party inventory is saved. Sheets redraw from it. */
export const PARTY_INVENTORY_HOOK = systemHookName('partyInventory');

export interface PartyCurrency {
	gp: number;
	sp: number;
	cp: number;
}

export interface PartyInventory {
	currency: PartyCurrency;
	items: TransferItem[];
}

export const PARTY_INVENTORY_HOLDER_FLAG = 'partyInventoryHolder';
export const PARTY_INVENTORY_FLAG = 'partyInventory';

export function emptyPartyInventory(): PartyInventory {
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

export function normalizePartyInventory(raw: unknown): PartyInventory {
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

export function readPartyInventorySetting(): PartyInventory {
	try {
		const settings = game.settings;
		if (!settings?.get) return emptyPartyInventory();
		return normalizePartyInventory(
			settings.get(SYSTEM_ID as 'core', PARTY_INVENTORY_SETTING as 'rollMode'),
		);
	} catch {
		return emptyPartyInventory();
	}
}

export async function writePartyInventorySetting(inventory: PartyInventory): Promise<void> {
	await game.settings.set(
		SYSTEM_ID as 'core',
		PARTY_INVENTORY_SETTING as 'rollMode',
		inventory as never,
	);
}

export function registerPartyInventorySetting(): void {
	game.settings.register(
		SYSTEM_ID as 'core',
		PARTY_INVENTORY_SETTING as 'rollMode',
		{
			name: 'Party inventory',
			scope: 'world',
			config: false,
			type: Object,
			default: emptyPartyInventory(),
			onChange: () => {
				// @ts-expect-error Custom hook
				Hooks.callAll(PARTY_INVENTORY_HOOK);
			},
		} as unknown as Parameters<typeof game.settings.register>[2],
	);
}
