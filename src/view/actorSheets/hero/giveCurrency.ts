import type { NimbleCharacter } from '#documents/actor/character.js';
import localize from '#utils/localize.ts';
import { requestCurrencyTransfer } from '#utils/partyStash/requestItemTransfer.ts';
import { readPartyStash } from '../../../settings/partyStashSetting.ts';
import type { HeroIntent } from './heroIntent.ts';

const INV = 'NIMBLE.actorSheet.hero.inventory';
const COINS = ['gp', 'sp', 'cp'] as const;

type Coin = (typeof COINS)[number];
type GiveIntent = Extract<HeroIntent, { kind: 'giveCurrency' }>;
type CoinBag = Record<Coin, number>;

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}

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

/** The number and the slider for one denomination show the same amount. */
function bindCoinSlider(root: ParentNode, coin: Coin, have: number): void {
	const amount = root.querySelector<HTMLInputElement>(`input[name="${coin}"]`);
	const slider = root.querySelector<HTMLInputElement>(`input[data-coin-slider="${coin}"]`);
	if (!amount || !slider) return;
	slider.addEventListener('input', () => {
		amount.value = String(clampCoin(slider.value, have));
	});
	amount.addEventListener('input', () => {
		const value = Math.floor(Number(amount.value));
		if (!Number.isFinite(value)) return;
		slider.value = String(Math.min(have, Math.max(0, value)));
	});
	amount.addEventListener('change', () => {
		const next = clampCoin(amount.value, have);
		amount.value = String(next);
		slider.value = String(next);
	});
}

function coinsDialogContent(held: CoinBag): string {
	const rows = COINS.map((coin) => {
		const have = held[coin];
		const label = escapeHtml(localize(`NIMBLE.currencyAbbreviations.${coin}`));
		return `<div style="display:flex;align-items:center;gap:8px">
			<label id="nimble-give-${coin}" for="nimble-give-${coin}-amount" style="width:2rem">${label}</label>
			<input type="range" data-coin-slider="${coin}" min="0" max="${have}" step="1" value="${have}" aria-labelledby="nimble-give-${coin}" style="flex:1">
			<input id="nimble-give-${coin}-amount" type="number" name="${coin}" min="0" max="${have}" step="1" value="${have}" style="width:5rem">
		</div>`;
	}).join('');
	return `<div class="nimble-give-coins" style="display:flex;flex-direction:column;gap:10px;min-width:16rem">${rows}</div>`;
}

async function askCoins(held: CoinBag): Promise<CoinBag | null> {
	const chosen = (await foundry.applications.api.DialogV2.wait({
		window: { title: localize(`${INV}.giveTo`) },
		content: coinsDialogContent(held),
		buttons: [
			{
				action: 'give',
				label: localize(`${INV}.give`),
				default: true,
				callback: (_event: Event, button: HTMLButtonElement) => {
					const read = (coin: Coin) => {
						const field = button.form?.elements.namedItem(coin) as { value?: string } | null;
						return clampCoin(String(field?.value ?? 0), held[coin]);
					};
					return { gp: read('gp'), sp: read('sp'), cp: read('cp') };
				},
			},
		],
		render: (_event: Event, dialog: { element: ParentNode }) => {
			for (const coin of COINS) bindCoinSlider(dialog.element, coin, held[coin]);
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
		intent.source === 'stash'
			? heldCoins(readPartyStash().currency)
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
