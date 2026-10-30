import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import {
	goblin,
	monsterAbility,
	monsterContext,
	soloMonster,
} from '../../../../../../tests/fixtures/actorSheets/monsterFixtures.ts';
import { createSheetUiState } from '../../../shared/sheetUiState.ts';
import { monsterAbilitiesTab } from '../../monsterAbilitiesTab.ts';
import MonsterAbilitiesTab from '../MonsterAbilitiesTab.svelte';

function renderTab(view = monsterAbilitiesTab(soloMonster(), monsterContext()), editing = false) {
	const ui = $state(createSheetUiState('abilities'));
	ui.editing = editing;
	const perform = vi.fn();
	const sheetDrop = vi.fn();
	const { container } = render(MonsterAbilitiesTab, { view, ui, perform });
	container.addEventListener('drop', sheetDrop);
	const entryOf = (id: string) => {
		const entry = container.querySelector<HTMLElement>(`[data-row-id="${id}"]`)!;
		entry.getBoundingClientRect = () => ({ top: 100, height: 40 }) as DOMRect;
		return entry;
	};
	return { ui, perform, sheetDrop, entryOf };
}

const ABOVE = 110;
const BELOW = 130;

/** A drag event with its pointer place: the jsdom window here has no DragEvent. */
async function fireDrag(
	type: 'dragstart' | 'dragover' | 'drop',
	target: HTMLElement,
	init: { clientY?: number; dataTransfer?: unknown } = {},
) {
	const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientY: init.clientY });
	Object.defineProperty(event, 'dataTransfer', { value: init.dataTransfer ?? null });
	target.dispatchEvent(event);
	await tick();
}

const transfer = (data?: Record<string, unknown>) => ({
	setData: vi.fn(),
	getData: () => (data ? JSON.stringify(data) : ''),
	types: ['text/plain'],
});

describe('MonsterAbilitiesTab', () => {
	it('rolls or posts an ability on a click of its name', async () => {
		const { perform } = renderTab();

		await fireEvent.click(screen.getByRole('button', { name: 'Move & Smack' }));

		expect(perform).toHaveBeenCalledWith({ kind: 'activate', itemId: 'moveAndSmack0001' });
	});

	it('starts with the text open, and the arrow closes it', async () => {
		const { ui } = renderTab();

		expect(screen.getByText(/Move 8, attack for 1d8\+2/)).toBeInTheDocument();
		const [arrow] = screen.getAllByRole('button', { expanded: true });
		await fireEvent.click(arrow);

		expect(ui.closedRows).toHaveLength(1);
	});

	it('opens the window of an ability and of an attack sequence from the pen', async () => {
		const { perform } = renderTab();

		await fireEvent.click(screen.getByRole('button', { name: 'Configure Actions' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Configure Grab & Throw' }));

		expect(perform).toHaveBeenNthCalledWith(1, { kind: 'openItem', itemId: 'sequence00000001' });
		expect(perform).toHaveBeenNthCalledWith(2, { kind: 'openItem', itemId: 'grabAndThrow0001' });
	});

	it('shows the text of the attack sequence above its actions', () => {
		renderTab();

		expect(screen.getByText('After each hero’s turn, choose one:')).toBeInTheDocument();
	});

	it('shows an item with no text and no effects as a heading line', () => {
		const monster = goblin();
		monster.items.push(monsterAbility(monster.id, 'tactics', 'Tactics', 'feature', 50000));
		renderTab(monsterAbilitiesTab(monster, monsterContext()));

		expect(screen.getByText('Tactics')).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Tactics' })).toBeNull();
	});

	it('a row drop of a dragged ability runs once: one reorder, and the sheet does not get the drop', async () => {
		const { perform, sheetDrop, entryOf } = renderTab();
		const data = { type: 'Item', uuid: 'Actor.pudge00000000001.Item.grabAndThrow0001' };

		await fireEvent.pointerDown(entryOf('grabAndThrow0001'), { pointerType: 'mouse' });
		await fireDrag('dragstart', entryOf('grabAndThrow0001'), { dataTransfer: transfer() });
		await fireDrag('dragover', entryOf('moveAndSmack0001'), {
			dataTransfer: transfer(),
			clientY: ABOVE,
		});
		await fireDrag('drop', entryOf('moveAndSmack0001'), {
			dataTransfer: transfer(data),
			clientY: ABOVE,
		});

		expect(perform).toHaveBeenCalledOnce();
		expect(perform).toHaveBeenCalledWith({
			kind: 'reorder',
			updates: [
				{ itemId: 'sequence00000001', sort: 0 },
				{ itemId: 'grabAndThrow0001', sort: 10000, parentItemId: 'sequence00000001' },
				{ itemId: 'moveAndSmack0001', sort: 20000 },
			],
		});
		expect(sheetDrop).not.toHaveBeenCalled();
	});

	it('draws a drop line, and a nest line below an attack sequence', async () => {
		const monster = soloMonster();
		monster.items.push(
			monsterAbility(monster.id, 'kick', 'Kick', 'action', 50000, { description: '<p>1d4.</p>' }),
		);
		const { entryOf } = renderTab(monsterAbilitiesTab(monster, monsterContext()));

		await fireEvent.pointerDown(entryOf('kick'), { pointerType: 'mouse' });
		await fireDrag('dragstart', entryOf('kick'), { dataTransfer: transfer() });
		await fireDrag('dragover', entryOf('sequence00000001'), { clientY: BELOW });

		expect(entryOf('sequence00000001')).toHaveClass('nest');

		await fireDrag('dragover', entryOf('grabAndThrow0001'), { clientY: ABOVE });

		expect(entryOf('grabAndThrow0001')).toHaveClass('above');
		expect(entryOf('sequence00000001')).not.toHaveClass('nest');
	});

	it('lets a drop from outside the sheet go on to the sheet', async () => {
		const { perform, sheetDrop, entryOf } = renderTab();
		const data = { type: 'Item', uuid: 'Compendium.nimble.monsterFeatures.Item.bite' };

		await fireDrag('drop', entryOf('moveAndSmack0001'), { dataTransfer: transfer(data) });

		expect(perform).not.toHaveBeenCalled();
		expect(sheetDrop).toHaveBeenCalledOnce();
	});

	it('does not reorder an ability into another group', async () => {
		const { perform, sheetDrop, entryOf } = renderTab();

		await fireEvent.pointerDown(entryOf('bloodied00000001'), { pointerType: 'mouse' });
		await fireDrag('dragstart', entryOf('bloodied00000001'), { dataTransfer: transfer() });
		await fireDrag('drop', entryOf('moveAndSmack0001'), {
			dataTransfer: transfer(),
			clientY: ABOVE,
		});

		expect(perform).not.toHaveBeenCalled();
		expect(sheetDrop).not.toHaveBeenCalled();
	});

	it('drags with a finger only in edit mode', async () => {
		const { entryOf, ui } = renderTab();
		const setData = vi.fn();

		await fireEvent.pointerDown(entryOf('moveAndSmack0001'), { pointerType: 'touch' });
		await fireDrag('dragstart', entryOf('moveAndSmack0001'), { dataTransfer: { setData } });

		expect(setData).not.toHaveBeenCalled();

		ui.editing = true;
		await fireDrag('dragstart', entryOf('moveAndSmack0001'), { dataTransfer: { setData } });

		expect(setData).toHaveBeenCalledWith(
			'text/plain',
			JSON.stringify({ type: 'Item', uuid: 'Actor.pudge00000000001.Item.moveAndSmack0001' }),
		);
	});

	it('in edit mode a card does not act, and its uses are a number that you type', async () => {
		const context = monsterContext({
			itemPools: {
				moveAndSmack0001: [{ id: 'smacks', label: 'Smacks', current: 2, max: 3, per: null }],
			},
		});
		const { perform } = renderTab(monsterAbilitiesTab(soloMonster(), context), true);

		expect(screen.queryByRole('button', { name: 'Move & Smack' })).toBeNull();
		const uses = screen.getByRole('spinbutton', { name: /usesOf.*Smacks/ });
		await fireEvent.input(uses, { target: { value: '1' } });
		await fireEvent.blur(uses);

		expect(perform).toHaveBeenCalledWith({ kind: 'setPoolCharges', poolId: 'smacks', value: 1 });
	});

	it.each([
		['a card', 'Move & Smack', 'moveAndSmack0001'],
		['an attack sequence', 'Actions', 'sequence00000001'],
		['a heading line', 'Tactics', 'tactics'],
	])('in edit mode %s asks before Delete, and deletes on Yes', async (_kind, name, itemId) => {
		const monster = soloMonster();
		monster.items.push(monsterAbility(monster.id, 'tactics', 'Tactics', 'feature', 50000));
		const { perform } = renderTab(monsterAbilitiesTab(monster, monsterContext()), true);

		await fireEvent.click(
			screen.getByRole('button', {
				name: `NIMBLE.actorSheet.shared.deleteName ${JSON.stringify({ name })}`,
			}),
		);
		expect(perform).not.toHaveBeenCalled();
		expect(
			screen.getByText(`NIMBLE.actorSheet.shared.deleteQuestion ${JSON.stringify({ name })}`),
		).toBeInTheDocument();

		await fireEvent.click(screen.getByRole('button', { name: 'NIMBLE.actorSheet.shared.delete' }));

		expect(perform).toHaveBeenCalledWith({ kind: 'deleteItem', itemId });
	});

	it('gives a heading line a pen in edit mode only', async () => {
		const monster = goblin();
		monster.items.push(monsterAbility(monster.id, 'tactics', 'Tactics', 'feature', 50000));
		const view = monsterAbilitiesTab(monster, monsterContext());

		renderTab(view);
		expect(screen.queryByRole('button', { name: 'Configure Tactics' })).toBeNull();

		document.body.innerHTML = '';
		const { perform } = renderTab(view, true);
		await fireEvent.click(screen.getByRole('button', { name: 'Configure Tactics' }));

		expect(perform).toHaveBeenCalledWith({ kind: 'openItem', itemId: 'tactics' });
	});

	it('says so when the monster has no abilities', () => {
		renderTab(monsterAbilitiesTab(goblin({ items: [] }), monsterContext()));

		expect(screen.getByText('NIMBLE.actorSheet.monster.abilities.empty')).toBeInTheDocument();
	});
});
