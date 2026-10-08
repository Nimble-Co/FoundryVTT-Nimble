type ItemPilesCurrency = {
	type: 'attribute';
	name: string;
	img: string;
	abbreviation: string;
	data: { path: string };
	primary: boolean;
	exchangeRate: number;
};

type ItemPilesApi = {
	addSystemIntegration(data: Record<string, unknown>): void;
};

type ItemPilesReadyHook = (event: 'item-piles-ready', fn: () => void) => number;

type ItemSource = { system?: Record<string, unknown> } & Record<string, unknown>;

const INTEGRATION_VERSION = '1.0.0';
const TRADEABLE_ITEM_TYPE = 'object';

function currencyPath(denomination: string): string {
	return `system.currency.${denomination}`;
}

export function getItemPilesCurrencies(): ItemPilesCurrency[] {
	return Object.entries(CONFIG.NIMBLE.currencies).map(([denomination, currency]) => ({
		type: 'attribute',
		name: currency.label,
		img: currency.img,
		abbreviation: `{#}${currency.abbreviation}`,
		data: { path: currencyPath(denomination) },
		primary: currency.exchangeRate === 1,
		exchangeRate: currency.exchangeRate,
	}));
}

/** The item price in the primary currency. The rates set in Item Piles win over the system rates. */
export function getItemCost(
	item: ItemSource,
	currencies: { data?: { path?: string }; exchangeRate?: number }[] = [],
): number {
	const value = Number(foundry.utils.getProperty(item, 'system.price.value')) || 0;
	const denomination = foundry.utils.getProperty(item, 'system.price.denomination') as
		| string
		| undefined;
	if (!denomination) return value;

	const configured = currencies.find(
		(currency) => currency.data?.path === currencyPath(denomination),
	);
	const systemRates: Record<string, { exchangeRate: number }> = CONFIG.NIMBLE.currencies;
	const exchangeRate = configured?.exchangeRate ?? systemRates[denomination]?.exchangeRate ?? 1;

	return value * exchangeRate;
}

/** State that belongs to the previous owner does not go with the item. */
export function transformItem(itemData: ItemSource): ItemSource {
	if (itemData?.system) {
		if ('equipped' in itemData.system) itemData.system.equipped = false;
		if ('containerId' in itemData.system) itemData.system.containerId = '';
	}
	return itemData;
}

export function getItemPilesConfig(): Record<string, unknown> {
	const nonTradeableTypes = Object.keys(CONFIG.Item.dataModels).filter(
		(type) => type !== TRADEABLE_ITEM_TYPE,
	);

	return {
		VERSION: INTEGRATION_VERSION,
		ACTOR_CLASS_TYPE: 'character',
		ITEM_CLASS_LOOT_TYPE: TRADEABLE_ITEM_TYPE,
		ITEM_CLASS_WEAPON_TYPE: TRADEABLE_ITEM_TYPE,
		ITEM_CLASS_EQUIPMENT_TYPE: TRADEABLE_ITEM_TYPE,
		ITEM_QUANTITY_ATTRIBUTE: 'system.quantity',
		ITEM_PRICE_ATTRIBUTE: 'system.price.value',
		ITEM_FILTERS: [{ path: 'type', filters: nonTradeableTypes.join(',') }],
		ITEM_SIMILARITIES: ['name', 'type'],
		ITEM_TRANSFORMER: transformItem,
		ITEM_COST_TRANSFORMER: getItemCost,
		CURRENCIES: getItemPilesCurrencies(),
	};
}

export default function registerItemPilesIntegration(): void {
	(Hooks.once as ItemPilesReadyHook)('item-piles-ready', () => {
		const api = (game as unknown as { itempiles?: { API?: ItemPilesApi } }).itempiles?.API;
		api?.addSystemIntegration(getItemPilesConfig());
	});
}
