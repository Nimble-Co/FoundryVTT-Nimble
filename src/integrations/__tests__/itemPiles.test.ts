import registerItemPilesIntegration, { getItemCost, transformItem } from '../itemPiles.js';

type ItemPilesPayload = {
	ACTOR_CLASS_TYPE: string;
	ITEM_QUANTITY_ATTRIBUTE: string;
	ITEM_PRICE_ATTRIBUTE: string;
	ITEM_FILTERS: { path: string; filters: string }[];
	ITEM_SIMILARITIES: string[];
	CURRENCIES: { data: { path: string }; exchangeRate: number; primary: boolean }[];
	ITEM_COST_TRANSFORMER: typeof getItemCost;
	ITEM_TRANSFORMER: typeof transformItem;
};

type ItemDataModels = { Item: { dataModels: Record<string, unknown> } };

function priced(value: number, denomination: string) {
	return { system: { price: { value, denomination } } };
}

function findReadyCallback(): (() => void) | undefined {
	const calls = vi.mocked(Hooks.once).mock.calls as unknown as [string, () => void][];
	return calls.find(([event]) => event === 'item-piles-ready')?.[1];
}

/** Runs the registered `item-piles-ready` callback and returns what it handed to Item Piles. */
function captureRegisteredPayload(): ItemPilesPayload {
	const addSystemIntegration = vi.fn();
	(game as unknown as { itempiles?: object }).itempiles = { API: { addSystemIntegration } };
	vi.mocked(Hooks.once).mockClear();

	registerItemPilesIntegration();

	const onReady = findReadyCallback();
	expect(onReady).toBeDefined();
	onReady!();
	expect(addSystemIntegration).toHaveBeenCalledTimes(1);
	return addSystemIntegration.mock.calls[0][0];
}

describe('itemPiles integration', () => {
	describe('getItemCost', () => {
		it.each([
			[5, 'gp', 5],
			[5, 'sp', 0.5],
			[5, 'cp', 0.05],
		])('reads %i %s as %f gold', (value, denomination, expected) => {
			expect(getItemCost(priced(value, denomination))).toBeCloseTo(expected);
		});

		it('uses the rate set in Item Piles before the system rate', () => {
			const currencies = [{ data: { path: 'system.currency.sp' }, exchangeRate: 0.5 }];

			expect(getItemCost(priced(4, 'sp'), currencies)).toBe(2);
		});

		it('reads an item without a price as 0', () => {
			expect(getItemCost({ system: {} })).toBe(0);
		});
	});

	describe('transformItem', () => {
		it('clears the equipped state and the container of the previous owner', () => {
			const item = { system: { equipped: true, containerId: 'abc', quantity: 2 } };

			expect(transformItem(item).system).toEqual({ equipped: false, containerId: '', quantity: 2 });
		});

		it('returns an object for empty item data', () => {
			expect(transformItem({})).toEqual({});
		});
	});

	describe('registerItemPilesIntegration', () => {
		const itemConfig = (CONFIG as unknown as ItemDataModels).Item;
		let originalDataModels: Record<string, unknown>;

		beforeEach(() => {
			originalDataModels = itemConfig.dataModels;
			itemConfig.dataModels = { object: {}, spell: {}, feature: {}, class: {} };
		});

		afterEach(() => {
			itemConfig.dataModels = originalDataModels;
			delete (game as unknown as { itempiles?: object }).itempiles;
		});

		it('points Item Piles at the item quantity and price', () => {
			const payload = captureRegisteredPayload();

			expect(payload.ITEM_QUANTITY_ATTRIBUTE).toBe('system.quantity');
			expect(payload.ITEM_PRICE_ATTRIBUTE).toBe('system.price.value');
			expect(payload.ACTOR_CLASS_TYPE).toBe('character');
		});

		it('registers each currency at its actor path with its exchange rate to gold', () => {
			const { CURRENCIES } = captureRegisteredPayload();

			expect(
				CURRENCIES.map(({ data, exchangeRate, primary }) => [data.path, exchangeRate, primary]),
			).toEqual([
				['system.currency.gp', 1, true],
				['system.currency.sp', 0.1, false],
				['system.currency.cp', 0.01, false],
			]);
		});

		it('leaves only object items tradable', () => {
			const { ITEM_FILTERS } = captureRegisteredPayload();

			expect(ITEM_FILTERS).toEqual([{ path: 'type', filters: 'spell,feature,class' }]);
		});

		it('keeps objects with a different price apart', () => {
			const { ITEM_SIMILARITIES } = captureRegisteredPayload();

			expect(ITEM_SIMILARITIES).toEqual(
				expect.arrayContaining(['name', 'type', 'system.price.value', 'system.price.denomination']),
			);
		});

		it('prices an item through the registered cost transformer and currencies', () => {
			const { ITEM_COST_TRANSFORMER, CURRENCIES } = captureRegisteredPayload();

			expect(ITEM_COST_TRANSFORMER(priced(5, 'sp'), CURRENCIES)).toBeCloseTo(0.5);
		});

		it('cleans an item through the registered item transformer', () => {
			const { ITEM_TRANSFORMER } = captureRegisteredPayload();

			expect(ITEM_TRANSFORMER({ system: { equipped: true } }).system).toEqual({ equipped: false });
		});

		it('does nothing when the Item Piles API is absent', () => {
			vi.mocked(Hooks.once).mockClear();
			registerItemPilesIntegration();
			const onReady = findReadyCallback();

			expect(onReady).toBeDefined();
			expect(() => onReady!()).not.toThrow();
		});
	});
});
