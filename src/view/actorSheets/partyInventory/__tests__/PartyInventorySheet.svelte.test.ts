import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import PartyInventorySheet from '../PartyInventorySheet.svelte';

describe('PartyInventorySheet', () => {
	it('lists the coins and items that are stored', () => {
		const { container } = render(PartyInventorySheet, {
			empty: 'The party inventory is empty.',
			items: [
				{ id: 'coin-gp', name: '2 gp', icon: 'fa-solid fa-coins', quantity: '' },
				{ id: 'torch', name: 'Torch', img: 'icons/equipment/torch.webp', quantity: 'x3' },
				{ id: 'rope', name: 'Rope', img: 'icons/svg/item-bag.svg', quantity: '' },
			],
		});

		expect(screen.getByText('2 gp')).toBeInTheDocument();
		expect(screen.getByText('Torch')).toBeInTheDocument();
		expect(screen.getByText('x3')).toBeInTheDocument();
		expect(screen.getByText('Rope')).toBeInTheDocument();
		expect(container.querySelector('img')).toHaveAttribute('src', 'icons/equipment/torch.webp');
		expect(container.querySelector('i.fa-coins')).toBeTruthy();
		expect(screen.queryByText('The party inventory is empty.')).not.toBeInTheDocument();
	});

	it('says the list is empty when nothing is stored', () => {
		render(PartyInventorySheet, {
			empty: 'The party inventory is empty.',
			items: [],
		});

		expect(screen.getByText('The party inventory is empty.')).toBeInTheDocument();
	});
});
