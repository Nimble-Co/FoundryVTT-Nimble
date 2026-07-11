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
