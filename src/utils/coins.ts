export const COIN_DENOMINATIONS = ['gp', 'sp', 'cp'] as const;

export type CoinDenomination = (typeof COIN_DENOMINATIONS)[number];

export const COIN_ABBREVIATION: Record<CoinDenomination, string> = {
	gp: 'NIMBLE.currencyAbbreviations.gp',
	sp: 'NIMBLE.currencyAbbreviations.sp',
	cp: 'NIMBLE.currencyAbbreviations.cp',
};

export function isCoinDenomination(coin: string): coin is CoinDenomination {
	return (COIN_DENOMINATIONS as readonly string[]).includes(coin);
}
