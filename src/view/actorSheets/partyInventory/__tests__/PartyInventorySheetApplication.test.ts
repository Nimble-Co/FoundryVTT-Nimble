import { describe, expect, it } from 'vitest';
import { SYSTEM_ID } from '#system';
import { PARTY_STASH_SETTING } from '../../../../settings/partyStashSetting.ts';
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
				scope === SYSTEM_ID && key === PARTY_STASH_SETTING
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
		try {
			const sheet = new PartyInventorySheet({ document: { name: 'Party Inventory' } } as never);
			const context = await (
				sheet as unknown as {
					_prepareContext(options: object): Promise<{
						items: { name: string; quantity: string }[];
					}>;
				}
			)._prepareContext({});

			expect(context.items.map((item) => item.name)).toEqual(['2 gp', '4 cp', 'Torch']);
			expect(context.items.map((item) => item.quantity)).toEqual(['', '', 'x3']);
		} finally {
			sheetPrototype._prepareContext = original;
			world.actors = previousActors;
			world.settings = previousSettings;
		}
	});
});
