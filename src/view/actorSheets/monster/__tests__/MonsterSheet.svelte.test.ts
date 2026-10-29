import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	minion,
	monsterContext,
	soloMonster,
} from '../../../../../tests/fixtures/actorSheets/monsterFixtures.ts';
import { createSheetUiState, revealIn } from '../../shared/sheetUiState.ts';
import MonsterSheet from '../MonsterSheet.svelte';
import type { MonsterActorLike } from '../monsterSource.ts';

function renderSheet(actor: MonsterActorLike = soloMonster()) {
	const ui = $state(createSheetUiState('abilities'));
	const perform = vi.fn();
	const source = () => ({ actor, context: monsterContext() });
	render(MonsterSheet, { source, ui, perform });
	return { ui, perform };
}

/** A ResizeObserver that reports one width, as Foundry's window would. */
function stubWidth(width: number) {
	vi.stubGlobal(
		'ResizeObserver',
		class {
			#callback: ResizeObserverCallback;
			constructor(callback: ResizeObserverCallback) {
				this.#callback = callback;
			}
			observe() {
				this.#callback([{ contentRect: { width } } as ResizeObserverEntry], this as never);
			}
			disconnect() {}
		},
	);
}

const RAIL_LABEL = 'NIMBLE.actorSheet.monster.rail.label';

afterEach(() => vi.unstubAllGlobals());

describe('MonsterSheet', () => {
	it('renders the rail and the name, and opens the Abilities tab', () => {
		stubWidth(660);
		renderSheet();

		expect(screen.getByRole('complementary', { name: RAIL_LABEL })).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'Pudge the Blunderer' })).toBeInTheDocument();
		expect(document.querySelector('[data-row-id="moveAndSmack0001"]')).not.toBeNull();
	});

	it.each([
		['effects', 'NIMBLE.actorSheet.shared.effects.allConditions'],
		['notes', 'NIMBLE.actorSheet.monster.notes.label'],
		['settings', 'NIMBLE.actorSheet.monster.settings.groups.monster'],
	])('opens the %s tab', async (tab, text) => {
		stubWidth(660);
		const { ui } = renderSheet();

		await fireEvent.click(screen.getByRole('tab', { name: new RegExp(`tabs.${tab}`) }));

		expect(ui.tab).toBe(tab);
		expect(screen.getAllByText(text).length).toBeGreaterThan(0);
	});

	it('closes every text with Collapse all, and opens them again with Expand all', async () => {
		stubWidth(660);
		const { ui } = renderSheet();

		await fireEvent.click(screen.getByRole('button', { name: /Collapse all/ }));

		expect(ui.closedRows).toHaveLength(4);
		expect(screen.queryByText(/Move 8, attack for 1d8\+2/)).toBeNull();

		await fireEvent.click(screen.getByRole('button', { name: /Expand all/ }));

		expect(ui.closedRows).toEqual([]);
	});

	it('shows the narrow form below 560 px: a header with the HP and a strip of tabs', async () => {
		stubWidth(390);
		const { ui } = renderSheet();

		expect(screen.getByRole('banner', { name: RAIL_LABEL })).toBeInTheDocument();
		expect(screen.getByRole('spinbutton', { name: /vitalPlate\.hp$/ })).toBeInTheDocument();
		await fireEvent.click(screen.getByRole('tab', { name: /tabs.notes/ }));
		expect(ui.tab).toBe('notes');
	});

	it('shows a minion with no HP', () => {
		stubWidth(660);
		renderSheet(minion());

		expect(screen.queryByRole('spinbutton', { name: /vitalPlate\.hp$/ })).toBeNull();
		expect(screen.getByText('NIMBLE.actorSheet.monster.rail.minion.noHp')).toBeInTheDocument();
	});

	it('flashes the row that reveal() asks for', async () => {
		stubWidth(660);
		const { ui } = renderSheet();

		revealIn(ui, { tab: 'abilities', rowId: 'grabAndThrow0001', flash: true });

		await waitFor(() =>
			expect(
				document.querySelector('[data-row-id="grabAndThrow0001"]')?.hasAttribute('data-flash'),
			).toBe(true),
		);
	});
});
