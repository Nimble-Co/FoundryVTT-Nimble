import { COIN_ABBREVIATION, COIN_DENOMINATIONS, type CoinDenomination } from '#utils/coins.ts';
import localize from '#utils/localize.ts';

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}

/** The number and the slider for one amount show the same value. */
function bindAmountSlider(
	root: ParentNode,
	options: { amount: string; slider: string; min: number; max: number },
): void {
	const amount = root.querySelector<HTMLInputElement>(options.amount);
	const slider = root.querySelector<HTMLInputElement>(options.slider);
	if (!amount || !slider) return;
	const clamp = (raw: string) => {
		const value = Math.floor(Number(raw));
		if (!Number.isFinite(value)) return options.min;
		return Math.min(options.max, Math.max(options.min, value));
	};
	slider.addEventListener('input', () => {
		amount.value = String(clamp(slider.value));
	});
	amount.addEventListener('change', () => {
		const next = clamp(amount.value);
		amount.value = String(next);
		slider.value = String(next);
	});
	amount.addEventListener('input', () => {
		const value = Math.floor(Number(amount.value));
		if (!Number.isFinite(value)) return;
		slider.value = String(Math.min(options.max, Math.max(options.min, value)));
	});
}

export function coinAmountDialog(held: Record<CoinDenomination, number>): string {
	const rows = COIN_DENOMINATIONS.map((coin) => {
		const have = held[coin];
		const label = escapeHtml(localize(COIN_ABBREVIATION[coin]));
		return `<div class="nimble-amount-dialog__row">
			<label class="nimble-amount-dialog__denomination" id="nimble-give-${coin}" for="nimble-give-${coin}-amount">${label}</label>
			<input class="nimble-amount-dialog__slider" type="range" data-coin-slider="${coin}" min="0" max="${have}" step="1" value="${have}" aria-labelledby="nimble-give-${coin}">
			<input class="nimble-amount-dialog__amount" id="nimble-give-${coin}-amount" type="number" name="${coin}" min="0" max="${have}" step="1" value="${have}">
		</div>`;
	}).join('');
	return `<div class="nimble-amount-dialog">${rows}</div>`;
}

export function bindCoinAmountSliders(
	root: ParentNode,
	held: Record<CoinDenomination, number>,
): void {
	for (const coin of COIN_DENOMINATIONS) {
		bindAmountSlider(root, {
			amount: `input[name="${coin}"]`,
			slider: `input[data-coin-slider="${coin}"]`,
			min: 0,
			max: held[coin],
		});
	}
}

export function quantityAmountDialog(question: string, have: number): string {
	return `<div class="nimble-amount-dialog">
		<label id="nimble-how-many-label" for="nimble-how-many-amount">${question}</label>
		<input class="nimble-amount-dialog__slider" type="range" data-quantity-slider min="1" max="${have}" step="1" value="${have}" aria-labelledby="nimble-how-many-label">
		<input class="nimble-amount-dialog__amount" id="nimble-how-many-amount" type="number" name="quantity" min="1" max="${have}" step="1" value="${have}">
	</div>`;
}

export function bindQuantityAmountSlider(root: ParentNode, have: number): void {
	bindAmountSlider(root, {
		amount: 'input[name="quantity"]',
		slider: 'input[data-quantity-slider]',
		min: 1,
		max: have,
	});
}
