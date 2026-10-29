import { describe, expect, it } from 'vitest';
import {
	blankHero,
	containerHero,
	heroContext,
} from '../../../../../tests/fixtures/actorSheets/heroFixtures.ts';
import { heroInventoryTab } from '../heroInventoryTab.ts';

const INV = 'NIMBLE.actorSheet.hero.inventory';

const layout = (view: ReturnType<typeof heroInventoryTab>) =>
	view.groups.map((group) => [
		group.label,
		group.rows.map((row) => (row.indent ? `  ${row.name}` : row.name)),
	]);

const rowOf = (view: ReturnType<typeof heroInventoryTab>, id: string) => {
	const row = view.groups.flatMap((group) => group.rows).find((entry) => entry.id === id);
	if (!row) throw new Error(`no row ${id}`);
	return row;
};

describe('heroInventoryTab', () => {
	it('groups the objects by type, shields with the armor, A to Z, stored rows under their container', () => {
		const view = heroInventoryTab(containerHero(), heroContext());

		expect(layout(view)).toEqual([
			['NIMBLE.objectTypeHeadings.weapon', ['Longsword']],
			['NIMBLE.objectTypeHeadings.armor', ['Leather Armor', 'Wooden Shield']],
			['NIMBLE.objectTypeHeadings.consumable', ['Healing Potion']],
			['NIMBLE.objectTypeHeadings.misc', ['Backpack', '  Rations', '  Rope', 'Pouch', 'Torch']],
		]);
	});

	it('shows the capacity of a container in the uses spot, or Empty', () => {
		const view = heroInventoryTab(containerHero(), heroContext());

		expect(rowOf(view, 'backpack').cost.text).toBe(`${INV}.capacity {"used":"6","capacity":"10"}`);
		expect(rowOf(view, 'pouch').cost.text).toBe(`${INV}.empty`);
		expect(rowOf(view, 'backpack').summaryTone).toBeUndefined();
	});

	it('warns when a container is over its capacity, and lets you go on', () => {
		const hero = containerHero({
			system: { inventory: { containerCapacityUsage: { backpack: 12 } } },
		});
		const row = rowOf(heroInventoryTab(hero, heroContext()), 'backpack');

		expect(row.summary).toBe(`${INV}.overCapacity {"used":"12","capacity":"10"}`);
		expect(row.summaryTone).toBe('warn');
		expect(row.use).toMatchObject({
			kind: 'act',
			intent: { kind: 'activate', itemId: 'backpack' },
		});
	});

	it('shows the quantity of a stack, and not a quantity of 1', () => {
		const view = heroInventoryTab(containerHero(), heroContext());

		expect(rowOf(view, 'torch').cost.text).toBe(`${INV}.quantity {"count":"3"}`);
		expect(rowOf(view, 'rope').cost.text).toBeUndefined();
		expect(rowOf(view, 'torch').fields[0]).toEqual({
			kind: 'quantity',
			itemId: 'torch',
			label: `${INV}.quantityOf {"name":"Torch"}`,
			value: 3,
		});
	});

	it('gives the EQUIP tag to weapons, armor, shields and objects with rules, never to a stored object', () => {
		const view = heroInventoryTab(containerHero(), heroContext());

		expect(rowOf(view, 'longsword').equip).toEqual({
			on: true,
			intent: { kind: 'toggleEquip', itemId: 'longsword' },
		});
		expect(rowOf(view, 'leather').equip?.on).toBe(true);
		expect(rowOf(view, 'shield').equip?.on).toBe(false);
		expect(rowOf(view, 'torch').equip).toBeUndefined();
		expect(rowOf(view, 'rope').equip).toBeUndefined();
	});

	it('gives a ring with rules the EQUIP tag', () => {
		const hero = containerHero();
		const ring = { ...hero.items.find((item) => item.id === 'torch')!, id: 'ring', name: 'Ring' };
		ring.rules = [{ id: 'r', type: 'armorClass', active: true, fields: {} }];
		hero.items.push(ring);

		expect(rowOf(heroInventoryTab(hero, heroContext()), 'ring').equip?.on).toBe(false);
	});

	it('offers Loose and each other container in Store in, and none for a container', () => {
		const view = heroInventoryTab(containerHero(), heroContext());

		expect(rowOf(view, 'rope').storeIn).toEqual({
			itemId: 'rope',
			label: `${INV}.storeIn {"name":"Rope"}`,
			value: 'backpack',
			options: [
				{ value: '', label: `${INV}.loose` },
				{ value: 'backpack', label: 'Backpack' },
				{ value: 'pouch', label: 'Pouch' },
			],
		});
		expect(rowOf(view, 'torch').storeIn?.value).toBe('');
		expect(rowOf(view, 'backpack').storeIn).toBeUndefined();
	});

	it('stores a drop on a container row in it, and a drop on a stored row in its container', () => {
		const view = heroInventoryTab(containerHero(), heroContext());

		expect(rowOf(view, 'backpack').dropInto).toBe('backpack');
		expect(rowOf(view, 'rope').dropInto).toBe('backpack');
		expect(rowOf(view, 'torch').dropInto).toBe('');
	});

	it('says that the objects in a container go back to the inventory when you delete it', () => {
		const view = heroInventoryTab(containerHero(), heroContext());

		expect(rowOf(view, 'backpack').remove).toEqual({
			label: 'NIMBLE.actorSheet.shared.deleteName {"name":"Backpack"}',
			question: 'NIMBLE.containers.deleteStocked {"container":"Backpack","count":"2"}',
			confirmLabel: 'NIMBLE.actorSheet.shared.delete',
			intent: { kind: 'deleteItem', itemId: 'backpack' },
		});
		expect(rowOf(view, 'pouch').remove?.question).toBe(
			'NIMBLE.actorSheet.shared.deleteQuestion {"name":"Pouch"}',
		);
	});

	it('gives the coins, gold first, and the slots with a warning when over the limit', () => {
		const view = heroInventoryTab(containerHero(), heroContext());
		expect(view.coins).toEqual([
			{ coin: 'gp', label: 'NIMBLE.currencyAbbreviations.gp', value: 12 },
			{ coin: 'sp', label: 'NIMBLE.currencyAbbreviations.sp', value: 4 },
			{ coin: 'cp', label: 'NIMBLE.currencyAbbreviations.cp', value: 30 },
		]);
		expect(view.slots).toEqual({
			text: `${INV}.slots {"used":"9","total":"13"}`,
			label: `${INV}.slotsLabel`,
			over: null,
		});

		const over = heroInventoryTab(
			containerHero({ system: { inventory: { usedSlots: 14 } } }),
			heroContext(),
		);
		expect(over.slots?.over).toBe(`${INV}.overSlots {"used":"14","total":"13"}`);
	});

	it('hides the slots when the hero does not track them', () => {
		const view = heroInventoryTab(
			containerHero({ flags: { trackInventorySlots: false } }),
			heroContext(),
		);

		expect(view.slots).toBeNull();
	});

	it('creates an object, and says so when the hero carries none', () => {
		const view = heroInventoryTab(blankHero(), heroContext());

		expect(view.createObject.intent).toEqual({ kind: 'createItem', itemType: 'object' });
		expect(view.empty).toBe(`${INV}.none`);
		expect(view.groups).toEqual([]);
	});
});
