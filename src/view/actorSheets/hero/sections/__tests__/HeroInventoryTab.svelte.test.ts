import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import {
	blankHero,
	containerHero,
	heroContext,
	objectItem,
} from '../../../../../../tests/fixtures/actorSheets/heroFixtures.ts';
import { createSheetUiState } from '../../../shared/sheetUiState.ts';
import { heroInventoryTab } from '../../heroInventoryTab.ts';
import type { HeroActorLike, HeroSheetContext } from '../../heroSource.ts';
import HeroInventoryTab from '../HeroInventoryTab.svelte';

const INV = 'NIMBLE.actorSheet.hero.inventory';
const SHARED = 'NIMBLE.actorSheet.shared';

function partyContext(overrides: Partial<HeroSheetContext['party']> = {}): HeroSheetContext {
	return heroContext({
		party: {
			currency: { gp: 40, sp: 0, cp: 0 },
			items: [objectItem('torch', 'Torch', { quantity: 3, objectSizeType: 'stackable' })],
			characters: [{ id: 'bob', name: 'Bob' }],
			canGive: true,
			canTake: true,
			canGiveAway: true,
			...overrides,
		},
	});
}

function renderTab(
	actor: HeroActorLike = containerHero(),
	editing = false,
	options: { party?: boolean; context?: HeroSheetContext } = {},
) {
	const ui = $state({ ...createSheetUiState('inventory'), editing });
	const perform = vi.fn();
	render(HeroInventoryTab, {
		view: heroInventoryTab(actor, options.context ?? heroContext(), { party: options.party }),
		ui,
		perform,
	});
	return { ui, perform };
}

const rowEl = (id: string) => document.querySelector<HTMLElement>(`[data-row-id="${id}"]`);

describe('HeroInventoryTab', () => {
	it('shows the groups by type, and the stored objects indented under their container', () => {
		renderTab();

		expect(screen.getAllByRole('heading').map((heading) => heading.textContent)).toEqual([
			'NIMBLE.objectTypeHeadings.weapon',
			'NIMBLE.objectTypeHeadings.armor',
			'NIMBLE.objectTypeHeadings.consumable',
			'NIMBLE.objectTypeHeadings.misc',
		]);
		expect(rowEl('rope')?.classList.contains('indent')).toBe(true);
		expect(rowEl('backpack')?.classList.contains('indent')).toBe(false);
	});

	it('equips and puts away from the tag in all modes', async () => {
		const { perform } = renderTab();

		const shield = rowEl('shield');
		if (!shield) throw new Error('no shield row');
		await fireEvent.click(within(shield).getByRole('button', { name: /^equip$/i, pressed: false }));

		expect(perform).toHaveBeenCalledWith({ kind: 'toggleEquip', itemId: 'shield' });
	});

	it('uses an object from its row', async () => {
		const { perform } = renderTab();

		await fireEvent.click(screen.getByRole('button', { name: /row\.use.*Torch/ }));

		expect(perform).toHaveBeenCalledWith({ kind: 'activate', itemId: 'torch' });
	});

	it('types a coin value out of edit mode', async () => {
		const { perform } = renderTab();
		const gold = screen.getByRole('spinbutton', { name: new RegExp(`${INV}.coin.*gp`) });

		await fireEvent.input(gold, { target: { value: '20' } });
		await fireEvent.blur(gold);

		expect(perform).toHaveBeenCalledWith({ kind: 'setCurrency', coin: 'gp', value: 20 });
	});

	it('creates an object out of edit mode', async () => {
		const { perform } = renderTab(blankHero());

		await fireEvent.click(screen.getByRole('button', { name: `${INV}.create` }));

		expect(perform).toHaveBeenCalledWith({ kind: 'createItem', itemType: 'object' });
		expect(screen.getByText(`${INV}.none`)).toBeInTheDocument();
	});

	it('shows the slots, with a warning when the hero carries too much', () => {
		renderTab(containerHero({ system: { inventory: { usedSlots: 14 } } }));

		const slots = screen.getByRole('status', { name: new RegExp(`${INV}.overSlots`) });
		expect(slots).toHaveTextContent(`${INV}.slots`);
		expect(slots.classList.contains('over')).toBe(true);
	});

	it('moves an object with Store in, in edit mode', async () => {
		const { perform } = renderTab(containerHero(), true);

		await fireEvent.change(
			screen.getByRole('combobox', { name: new RegExp(`${INV}.storeIn.*Torch`) }),
			{
				target: { value: 'pouch' },
			},
		);

		expect(perform).toHaveBeenCalledWith({
			kind: 'storeIn',
			itemId: 'torch',
			containerId: 'pouch',
		});
	});

	it('types a quantity on the row, before the ellipsis and the edit button', async () => {
		const { perform } = renderTab();
		const row = rowEl('torch');
		if (!row) throw new Error('no torch row');
		const bar = row.querySelector('.rw');
		if (!bar) throw new Error('no row bar');
		const quantity = within(row).getByRole('spinbutton', {
			name: new RegExp(`${INV}.quantityOf.*Torch`),
		});
		const menu = within(row).getByRole('button', { name: new RegExp(`${INV}.actions.*Torch`) });
		const edit = within(row).getByRole('button', { name: 'Configure Torch' });

		expect(bar.contains(quantity)).toBe(true);
		expect(within(row).queryByText(`${INV}.quantity {"count":"3"}`)).toBeNull();
		expect(quantity.compareDocumentPosition(menu) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
		expect(menu.compareDocumentPosition(edit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
		expect(getComputedStyle(menu).position).not.toBe('absolute');

		await fireEvent.input(quantity, { target: { value: '5' } });
		await fireEvent.blur(quantity);

		expect(perform).toHaveBeenCalledWith({ kind: 'setQuantity', itemId: 'torch', value: 5 });
		expect(within(rowEl('rope')!).queryByRole('spinbutton')).toBeNull();
		expect(within(rowEl('leather')!).queryByRole('spinbutton')).toBeNull();
	});

	it('keeps a single quantity field in edit mode', () => {
		renderTab(containerHero(), true);
		const row = rowEl('torch');
		if (!row) throw new Error('no torch row');

		expect(
			within(row).getAllByRole('spinbutton', { name: new RegExp(`${INV}.quantityOf.*Torch`) }),
		).toHaveLength(1);
	});

	it('asks before it deletes, and Keep deletes nothing', async () => {
		const { perform } = renderTab(containerHero(), true);

		await fireEvent.click(
			screen.getByRole('button', { name: new RegExp(`${SHARED}.deleteName.*Backpack`) }),
		);
		expect(screen.getByRole('alertdialog')).toHaveTextContent('NIMBLE.containers.deleteStocked');
		await fireEvent.click(screen.getByRole('button', { name: 'Keep' }));
		expect(screen.queryByRole('alertdialog')).toBeNull();
		expect(perform).not.toHaveBeenCalled();

		await fireEvent.click(
			screen.getByRole('button', { name: new RegExp(`${SHARED}.deleteName.*Backpack`) }),
		);
		await fireEvent.click(screen.getByRole('button', { name: `${SHARED}.delete` }));
		expect(perform).toHaveBeenCalledWith({ kind: 'deleteItem', itemId: 'backpack' });
	});

	it('shows no Delete and no Store in out of edit mode', () => {
		renderTab();

		expect(screen.queryByRole('button', { name: new RegExp(`${SHARED}.deleteName`) })).toBeNull();
		expect(screen.queryByRole('combobox')).toBeNull();
	});

	describe('drops', () => {
		const dropOf = (data: unknown) => ({
			dataTransfer: { getData: () => JSON.stringify(data), types: ['text/plain'] },
		});
		const item = { type: 'Item', uuid: 'Compendium.x.Item.lantern' };

		it('stores an Item dropped on a container row in it, and stops the drop there', async () => {
			const { perform } = renderTab();
			const outer = vi.fn();
			document.body.addEventListener('drop', outer);

			await fireEvent.drop(rowEl('backpack')!, dropOf(item));

			expect(perform).toHaveBeenCalledWith({
				kind: 'dropItem',
				data: item,
				containerId: 'backpack',
			});
			expect(perform).toHaveBeenCalledOnce();
			expect(outer).not.toHaveBeenCalled();
			document.body.removeEventListener('drop', outer);
		});

		it('puts an Item dropped on a stored row in the same container', async () => {
			const { perform } = renderTab();

			await fireEvent.drop(rowEl('rope')!, dropOf(item));

			expect(perform).toHaveBeenCalledWith({
				kind: 'dropItem',
				data: item,
				containerId: 'backpack',
			});
		});

		it('drops an Item on the list loose', async () => {
			const { perform } = renderTab();

			await fireEvent.drop(screen.getByText('NIMBLE.objectTypeHeadings.misc'), dropOf(item));

			expect(perform).toHaveBeenCalledWith({ kind: 'dropItem', data: item, containerId: '' });
		});

		it('lets a drop of anything else go on to the sheet', async () => {
			const { perform } = renderTab();
			const outer = vi.fn();
			document.body.addEventListener('drop', outer);

			await fireEvent.drop(rowEl('backpack')!, dropOf({ type: 'ActiveEffect', uuid: 'a' }));

			expect(perform).not.toHaveBeenCalled();
			expect(outer).toHaveBeenCalledOnce();
			document.body.removeEventListener('drop', outer);
		});

		it('rings a container row while an Item is dragged over it', async () => {
			renderTab();

			await fireEvent.dragEnter(rowEl('backpack')!);
			expect(rowEl('backpack')?.classList.contains('drop-over')).toBe(true);
			await fireEvent.dragEnter(rowEl('torch')!);
			expect(rowEl('torch')?.classList.contains('drop-over')).toBe(false);
		});
	});

	describe('the party inventory', () => {
		it('switches the list when the Party Inventory tab is chosen', async () => {
			const { ui } = renderTab();
			const mine = screen.getByRole('tab', { name: `${INV}.mine` });
			const party = screen.getByRole('tab', { name: `${INV}.party` });

			expect(mine).toHaveAttribute('aria-selected', 'true');
			expect(party).toHaveAttribute('aria-selected', 'false');
			await fireEvent.click(party);

			expect(ui.partyInventory).toBe(true);
		});

		it('gives coins from the button beside the coins', async () => {
			const { perform } = renderTab(containerHero(), false, { context: partyContext() });

			await fireEvent.click(screen.getByRole('button', { name: `${INV}.giveTo` }));
			await fireEvent.click(screen.getByRole('menuitem', { name: 'Bob' }));

			expect(perform).toHaveBeenCalledWith({
				kind: 'giveCurrency',
				source: 'actor',
				sourceActorId: 'containerHero0001',
				destination: { kind: 'actor', actorId: 'bob' },
			});
		});

		it('hides Create Object, edits the shared coins, and ignores a drop', async () => {
			const { perform } = renderTab(containerHero(), false, {
				party: true,
				context: partyContext(),
			});
			const gold = screen.getByRole('spinbutton', { name: new RegExp(`${INV}.coin.*gp`) });

			expect(screen.queryByRole('button', { name: `${INV}.create` })).toBeNull();
			expect(gold).toHaveValue(40);
			await fireEvent.input(gold, { target: { value: '20' } });
			await fireEvent.blur(gold);
			expect(perform).toHaveBeenCalledWith({ kind: 'setPartyCurrency', coin: 'gp', value: 20 });

			await fireEvent.drop(screen.getByText('NIMBLE.objectTypeHeadings.misc'), {
				dataTransfer: {
					getData: () => JSON.stringify({ type: 'Item', uuid: 'Item.lantern' }),
					types: ['text/plain'],
				},
			});
			expect(perform).toHaveBeenCalledOnce();
		});

		it('locks the coin fields when this user cannot take from the stash', () => {
			renderTab(containerHero(), false, {
				party: true,
				context: partyContext({ canTake: false, canGiveAway: false }),
			});

			const gold = screen.getByRole('spinbutton', { name: new RegExp(`${INV}.coin.*gp`) });
			expect(gold.classList.contains('rest')).toBe(true);
			expect(screen.queryByRole('button', { name: new RegExp(`${INV}.actions`) })).toBeNull();
		});

		it('moves an object to the party inventory from the menu, and does not use it', async () => {
			const { perform } = renderTab();

			await fireEvent.click(
				screen.getByRole('button', { name: new RegExp(`${INV}.actions.*Torch`) }),
			);
			expect(screen.getByText(`${INV}.moveTo`)).toBeInTheDocument();
			expect(screen.queryByRole('menuitem', { name: `${INV}.moveTo` })).toBeNull();
			await fireEvent.click(screen.getByRole('menuitem', { name: `${INV}.party` }));

			expect(perform).toHaveBeenCalledOnce();
			expect(perform).toHaveBeenCalledWith({
				kind: 'transferObject',
				itemId: 'torch',
				source: 'actor',
				sourceActorId: 'containerHero0001',
				destination: { kind: 'stash' },
			});
		});

		it('stores an object in a container from Move to', async () => {
			const { perform } = renderTab();

			await fireEvent.click(
				screen.getByRole('button', { name: new RegExp(`${INV}.actions.*Torch`) }),
			);
			await fireEvent.click(screen.getByRole('menuitem', { name: 'Backpack' }));

			expect(perform).toHaveBeenCalledWith({
				kind: 'storeIn',
				itemId: 'torch',
				containerId: 'backpack',
			});
		});

		it('opens the menu on a right-click, and Give to lists the other character', async () => {
			const { perform } = renderTab(containerHero(), false, { context: partyContext() });

			await fireEvent.contextMenu(rowEl('torch')!);
			expect(screen.getByText(`${INV}.giveTo`)).toBeInTheDocument();
			expect(screen.queryByRole('menuitem', { name: `${INV}.giveTo` })).toBeNull();
			await fireEvent.click(screen.getByRole('menuitem', { name: 'Bob' }));

			expect(perform).toHaveBeenCalledWith({
				kind: 'transferObject',
				itemId: 'torch',
				source: 'actor',
				sourceActorId: 'containerHero0001',
				destination: { kind: 'actor', actorId: 'bob' },
			});
		});

		it('closes the menu on a click outside and on Escape', async () => {
			renderTab();
			const open = () =>
				fireEvent.click(screen.getByRole('button', { name: new RegExp(`${INV}.actions.*Torch`) }));

			await open();
			expect(screen.getByRole('menu')).toBeInTheDocument();
			await fireEvent.pointerDown(document.body);
			expect(screen.queryByRole('menu')).toBeNull();

			await open();
			await fireEvent.keyDown(document, { key: 'Escape' });
			expect(screen.queryByRole('menu')).toBeNull();
		});

		it('shows a stash stack as text, with the ellipsis after it', () => {
			renderTab(containerHero(), false, { party: true, context: partyContext() });
			const row = rowEl('torch');
			if (!row) throw new Error('no torch row');
			const count = within(row).getByText(`${INV}.quantity {"count":"3"}`);
			const menu = within(row).getByRole('button', { name: new RegExp(`${INV}.actions.*Torch`) });

			expect(
				within(row).queryByRole('spinbutton', { name: new RegExp(`${INV}.quantityOf.*Torch`) }),
			).toBeNull();
			expect(count.compareDocumentPosition(menu) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
			expect(getComputedStyle(menu).position).not.toBe('absolute');
		});

		it('moves a stash object onto this character', async () => {
			const { perform } = renderTab(containerHero(), false, {
				party: true,
				context: partyContext(),
			});

			await fireEvent.click(
				screen.getByRole('button', { name: new RegExp(`${INV}.actions.*Torch`) }),
			);
			await fireEvent.click(screen.getByRole('menuitem', { name: `${INV}.mine` }));

			expect(perform).toHaveBeenCalledWith({
				kind: 'transferObject',
				itemId: 'torch',
				source: 'stash',
				sourceActorId: 'containerHero0001',
				destination: { kind: 'actor', actorId: 'containerHero0001' },
			});
		});
	});
});
