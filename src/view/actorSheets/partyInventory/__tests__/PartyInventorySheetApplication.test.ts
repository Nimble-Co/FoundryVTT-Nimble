import { describe, expect, it } from 'vitest';
import { SYSTEM_ID } from '#system';
import { PARTY_INVENTORY_SETTING } from '../../../../settings/partyInventorySetting.ts';
import PartyInventorySheet from '../PartyInventorySheetApplication.svelte.ts';

const world = game as unknown as {
	actors: unknown;
	settings?: { get?: (scope: string, key: string) => unknown };
};

describe('PartyInventorySheet', () => {
	it('labels a coin balance with the count and the denomination', async () => {
		const previousActors = world.actors;
		const previousSettings = world.settings;
		world.actors = [];
		world.settings = {
			get: (scope, key) =>
				scope === SYSTEM_ID && key === PARTY_INVENTORY_SETTING
					? {
							currency: { gp: 2, sp: 0, cp: 4 },
							items: [
								{
									_id: 'torch',
									type: 'object',
									name: 'Torch',
									system: { objectSizeType: 'stackable', quantity: 3 },
								},
							],
						}
					: undefined,
		};
		const sheetPrototype = Object.getPrototypeOf(
			Object.getPrototypeOf(PartyInventorySheet.prototype),
		) as { _prepareContext?: (options: object) => Promise<object> };
		const original = sheetPrototype._prepareContext;
		sheetPrototype._prepareContext = async () => ({});
		const i18n = game.i18n as {
			localize: (key: string) => string;
			format: (key: string, data?: Record<string, string>) => string;
		};
		const originalLocalize = i18n.localize.bind(i18n);
		const originalFormat = i18n.format.bind(i18n);
		i18n.localize = (key: string) => {
			if (key === 'NIMBLE.currencyAbbreviations.gp') return 'po';
			if (key === 'NIMBLE.currencyAbbreviations.cp') return 'pc';
			return originalLocalize(key);
		};
		i18n.format = (key: string, data?: Record<string, string>) => {
			if (key === 'NIMBLE.actorSheet.hero.inventory.coinBalance') {
				return `${data?.coin}: ${data?.count}`;
			}
			return originalFormat(key, data);
		};
		try {
			const sheet = new PartyInventorySheet({ document: { name: 'Party Inventory' } } as never);
			const context = await (
				sheet as unknown as {
					_prepareContext(options: object): Promise<{
						items: { name: string; quantity: string }[];
					}>;
				}
			)._prepareContext({});

			expect(context.items.map((item) => item.name)).toEqual(['po: 2', 'pc: 4', 'Torch']);
			expect(context.items.map((item) => item.quantity)).toEqual(['', '', 'x3']);
		} finally {
			i18n.localize = originalLocalize;
			i18n.format = originalFormat;
			sheetPrototype._prepareContext = original;
			world.actors = previousActors;
			world.settings = previousSettings;
		}
	});

	it('titles the window with the localized party name', () => {
		const i18n = game.i18n as { localize: (key: string) => string };
		const original = i18n.localize;
		i18n.localize = (key: string) =>
			key === 'NIMBLE.actorSheet.hero.inventory.party' ? 'Inventaire' : original(key);
		try {
			const sheet = new PartyInventorySheet({ document: { name: 'Goblin' } } as never);
			expect(sheet.title).toBe('Inventaire');
		} finally {
			i18n.localize = original;
		}
	});
});
