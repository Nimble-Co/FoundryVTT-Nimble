import type { NimbleCharacter } from '#documents/actor/character.js';
import { readPartyInventory } from '#documents/actor/partyInventoryHolder.js';
import type { CoinDenomination } from '#utils/coins.ts';
import localize from '#utils/localize.ts';
import { requestCurrencyTransfer } from '#utils/partyInventory/requestItemTransfer.ts';
import { bindCoinAmountSliders, coinAmountDialog } from './amountDialog.ts';
import type { HeroIntent } from './heroIntent.ts';

type GiveIntent = Extract<HeroIntent, { kind: 'giveCurrency' }>;
type CoinBag = Record<CoinDenomination, number>;

function coinAmount(value: unknown): number {
	const number = Math.floor(Number(value));
	return Number.isFinite(number) && number > 0 ? number : 0;
}

function heldCoins(source: { gp?: unknown; sp?: unknown; cp?: unknown } | undefined): CoinBag {
	return { gp: coinAmount(source?.gp), sp: coinAmount(source?.sp), cp: coinAmount(source?.cp) };
}

function clampCoin(raw: string, have: number): number {
	const value = Math.floor(Number(raw));
	if (!Number.isFinite(value)) return 0;
	return Math.min(have, Math.max(0, value));
}

async function askCoins(held: CoinBag): Promise<CoinBag | null> {
	const chosen = (await foundry.applications.api.DialogV2.wait({
		window: { title: localize('NIMBLE.actorSheet.hero.inventory.giveTo') },
		content: coinAmountDialog(held),
		buttons: [
			{
				action: 'give',
				label: localize('NIMBLE.actorSheet.hero.inventory.give'),
				default: true,
				callback: (_event: Event, button: HTMLButtonElement) => {
					const read = (coin: CoinDenomination) => {
						const field = button.form?.elements.namedItem(coin) as { value?: string } | null;
						return clampCoin(String(field?.value ?? 0), held[coin]);
					};
					return { gp: read('gp'), sp: read('sp'), cp: read('cp') };
				},
			},
		],
		render: (_event: Event, dialog: { element: ParentNode }) => {
			bindCoinAmountSliders(dialog.element, held);
		},
		rejectClose: false,
		modal: true,
	} as never)) as unknown;
	if (!chosen || typeof chosen !== 'object') return null;
	const bag = chosen as Partial<CoinBag>;
	return {
		gp: clampCoin(String(bag.gp ?? 0), held.gp),
		sp: clampCoin(String(bag.sp ?? 0), held.sp),
		cp: clampCoin(String(bag.cp ?? 0), held.cp),
	};
}

/** Asks how many of each coin, then moves that amount to the chosen character or the party. */
export async function giveCurrency(actor: NimbleCharacter, intent: GiveIntent): Promise<void> {
	const held =
		intent.source === 'party'
			? heldCoins(readPartyInventory().currency)
			: heldCoins(actor.system.currency);
	if (held.gp + held.sp + held.cp <= 0) return;
	const chosen = await askCoins(held);
	if (!chosen || chosen.gp + chosen.sp + chosen.cp <= 0) return;
	await requestCurrencyTransfer({
		source: intent.source,
		sourceActorId: intent.sourceActorId,
		destination: intent.destination,
		gp: chosen.gp,
		sp: chosen.sp,
		cp: chosen.cp,
	});
}
