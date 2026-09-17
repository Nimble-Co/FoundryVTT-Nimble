import { fireEvent, render } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';

import PlayerCharacterInventoryTabHarness from '../../../../tests/harnesses/PlayerCharacterInventoryTabHarness.svelte';

function renderInventory(
	items: { _id: string; name: string; system: Record<string, unknown> }[],
	updateItem = vi.fn(),
) {
	const result = render(PlayerCharacterInventoryTabHarness, {
		props: { items, updateItem },
	});

	const quantityInputs = Array.from(
		result.container.querySelectorAll<HTMLInputElement>('.nimble-document-card__quantity'),
	);

	return { ...result, updateItem, quantityInputs };
}

describe('PlayerCharacterInventoryTab quantity input', () => {
	it('does not disable the quantity input for slot-sized objects', () => {
		const { quantityInputs } = renderInventory([
			{ _id: 'slots-item', name: 'Bedroll', system: { objectSizeType: 'slots', quantity: 3 } },
		]);

		expect(quantityInputs).toHaveLength(1);
		expect(quantityInputs[0].disabled).toBe(false);
	});

	it('does not disable the quantity input for negligible objects', () => {
		const { quantityInputs } = renderInventory([
			{
				_id: 'negligible-item',
				name: 'Coin',
				system: { objectSizeType: 'negligible', quantity: 5 },
			},
		]);

		expect(quantityInputs).toHaveLength(1);
		expect(quantityInputs[0].disabled).toBe(false);
	});

	it('persists a new quantity for a slot-sized object via updateItem', async () => {
		const { quantityInputs, updateItem } = renderInventory([
			{ _id: 'slots-item', name: 'Bedroll', system: { objectSizeType: 'slots', quantity: 3 } },
		]);

		const input = quantityInputs[0];
		input.value = '7';
		await fireEvent.change(input);

		expect(updateItem).toHaveBeenCalledWith('slots-item', { 'system.quantity': '7' });
	});
});

function renderWithContainers(
	items: { _id: string; name: string; system: Record<string, unknown> }[],
	handlers: {
		storeItemInContainer?: ReturnType<typeof vi.fn>;
		removeItemFromContainer?: ReturnType<typeof vi.fn>;
	} = {},
) {
	const storeItemInContainer = handlers.storeItemInContainer ?? vi.fn();
	const removeItemFromContainer = handlers.removeItemFromContainer ?? vi.fn();

	const result = render(PlayerCharacterInventoryTabHarness, {
		props: { items, storeItemInContainer, removeItemFromContainer },
	});

	return { ...result, storeItemInContainer, removeItemFromContainer };
}

function getRow(container: HTMLElement, itemId: string): HTMLElement {
	const row = container.querySelector<HTMLElement>(`[data-item-id="${itemId}"]`);
	if (!row) throw new Error(`No inventory row rendered for ${itemId}`);
	return row;
}

function mockDraggedItem(uuid: string): void {
	vi.mocked(foundry.applications.ux.TextEditor.implementation.getDragEventData).mockReturnValue({
		type: 'Item',
		uuid,
	});
}

const bagOfHolding = {
	_id: 'bag',
	name: 'Bag of Holding',
	system: { objectSizeType: 'slots', slotsRequired: 1, container: { enabled: true } },
};

const plateArmor = {
	_id: 'armor',
	name: 'Plate Armor',
	system: { objectSizeType: 'slots', slotsRequired: 4 },
};

const storedPlateArmor = {
	...plateArmor,
	system: { ...plateArmor.system, containerId: 'bag' },
};

describe('PlayerCharacterInventoryTab containers', () => {
	it('nests a stored object inside its container rather than listing it on its own', () => {
		const { container } = renderWithContainers([bagOfHolding, storedPlateArmor]);

		const storedList = getRow(container, 'bag').querySelector('.nimble-item-list--stored');

		expect(storedList).not.toBeNull();
		expect(storedList?.querySelector('[data-item-id="armor"]')).not.toBeNull();
		expect(container.querySelectorAll('[data-item-id="armor"]')).toHaveLength(1);
	});

	it('shows a stored object on its own when the search hides its container', async () => {
		const { container } = renderWithContainers([bagOfHolding, storedPlateArmor]);

		const searchField = container.querySelector<HTMLInputElement>('input[type="search"]');
		if (!searchField) throw new Error('No search field rendered');

		searchField.value = 'Plate';
		await fireEvent.keyUp(searchField);

		expect(container.querySelector('[data-item-id="bag"]')).toBeNull();
		expect(container.querySelector('[data-item-id="armor"]')).not.toBeNull();
	});

	it('reports how much of the container capacity is used', () => {
		const chest = {
			_id: 'chest',
			name: 'Chest',
			system: {
				objectSizeType: 'slots',
				slotsRequired: 2,
				container: { enabled: true, capacity: 10 },
			},
		};
		const { container } = renderWithContainers([
			chest,
			{ ...plateArmor, system: { ...plateArmor.system, containerId: 'chest' } },
		]);

		expect(getRow(container, 'chest').textContent).toContain('4 / 10 slots stored');
	});

	it('says so when a container holds nothing', () => {
		const { container } = renderWithContainers([bagOfHolding]);

		expect(getRow(container, 'bag').textContent).toContain('Nothing stored');
	});

	it('stores a carried object dropped onto a container', async () => {
		const { container, storeItemInContainer } = renderWithContainers([bagOfHolding, plateArmor]);

		mockDraggedItem('Item.armor');
		await fireEvent.drop(getRow(container, 'bag'));

		expect(storeItemInContainer).toHaveBeenCalledWith('armor', 'bag');
	});

	it('ignores a container dropped onto itself', async () => {
		const { container, storeItemInContainer } = renderWithContainers([bagOfHolding]);

		mockDraggedItem('Item.bag');
		await fireEvent.drop(getRow(container, 'bag'));

		expect(storeItemInContainer).not.toHaveBeenCalled();
	});

	it('takes a stored object out when it is dragged onto the inventory list', async () => {
		const { container, removeItemFromContainer } = renderWithContainers([
			bagOfHolding,
			storedPlateArmor,
		]);

		const inventoryList = container.querySelector('.nimble-sheet__body--player-character');
		if (!inventoryList) throw new Error('No inventory list rendered');

		mockDraggedItem('Item.armor');
		await fireEvent.drop(inventoryList);

		expect(removeItemFromContainer).toHaveBeenCalledWith('armor');
	});

	it('leaves an object carried directly alone when it is dropped on the inventory list', async () => {
		const { container, removeItemFromContainer } = renderWithContainers([plateArmor]);

		const inventoryList = container.querySelector('.nimble-sheet__body--player-character');
		if (!inventoryList) throw new Error('No inventory list rendered');

		mockDraggedItem('Item.armor');
		await fireEvent.drop(inventoryList);

		expect(removeItemFromContainer).not.toHaveBeenCalled();
	});

	it('takes a stored object out when it is dragged onto an object carried directly', async () => {
		const { container, removeItemFromContainer } = renderWithContainers([
			bagOfHolding,
			storedPlateArmor,
			{ _id: 'sword', name: 'Longsword', system: { objectSizeType: 'slots', slotsRequired: 2 } },
		]);

		mockDraggedItem('Item.armor');
		await fireEvent.drop(getRow(container, 'sword'));

		expect(removeItemFromContainer).toHaveBeenCalledWith('armor');
	});

	it('stores an object dragged onto a row that is itself inside a container', async () => {
		const { container, storeItemInContainer } = renderWithContainers([
			bagOfHolding,
			storedPlateArmor,
			{ _id: 'sword', name: 'Longsword', system: { objectSizeType: 'slots', slotsRequired: 2 } },
		]);

		mockDraggedItem('Item.sword');
		await fireEvent.drop(getRow(container, 'armor'));

		expect(storeItemInContainer).toHaveBeenCalledWith('sword', 'bag');
	});

	it('offers no equip toggle for a stored object', () => {
		const { container } = renderWithContainers([
			bagOfHolding,
			{
				...storedPlateArmor,
				system: { ...storedPlateArmor.system, rules: [{ type: 'armorClass' }] },
			},
		]);

		const row = getRow(container, 'armor');

		expect(row.querySelector('[aria-label^="Toggle"]')).toBeNull();
		expect(row.querySelector('.nimble-document-card__quantity')).not.toBeNull();
	});

	it('drags the stored object itself, not the container it sits inside', async () => {
		const draggedItemIds: (string | undefined)[] = [];
		const { container } = render(PlayerCharacterInventoryTabHarness, {
			props: {
				items: [bagOfHolding, storedPlateArmor],
				onDragStart: (event: DragEvent) => {
					const row = event.currentTarget as HTMLElement | null;
					draggedItemIds.push(row?.dataset.itemId);
				},
			},
		});

		await fireEvent.dragStart(getRow(container, 'armor'));

		// The container row wraps its contents, so an unstopped dragstart reaches it
		// second and overwrites the drag data with the container.
		expect(draggedItemIds).toEqual(['armor']);
	});

	it('offers the equip toggle for the same object carried directly', () => {
		const { container } = renderWithContainers([
			{ ...plateArmor, system: { ...plateArmor.system, rules: [{ type: 'armorClass' }] } },
		]);

		expect(getRow(container, 'armor').querySelector('[aria-label^="Toggle"]')).not.toBeNull();
	});

	it('offers the equip toggle to a rule-less container that only applies while equipped', () => {
		const { container } = renderWithContainers([
			{
				_id: 'harness',
				name: 'Harness',
				system: {
					objectSizeType: 'slots',
					slotsRequired: 1,
					container: { enabled: true, slotCostMode: 'ignore', requiresEquipped: true },
				},
			},
		]);

		// Without it the setting could never be satisfied and the container would
		// silently do nothing.
		expect(getRow(container, 'harness').querySelector('[aria-label^="Toggle"]')).not.toBeNull();
	});

	it('offers no equip toggle to a rule-less container that applies whatever it does', () => {
		const { container } = renderWithContainers([bagOfHolding]);

		const row = getRow(container, 'bag');

		expect(row.querySelector('[aria-label^="Toggle"]')).toBeNull();
		expect(row.querySelector('.nimble-document-card__quantity')).not.toBeNull();
	});
});
