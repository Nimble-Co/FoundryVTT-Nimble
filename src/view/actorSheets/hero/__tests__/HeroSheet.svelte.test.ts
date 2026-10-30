import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { blankHero, heroContext } from '../../../../../tests/fixtures/actorSheets/heroFixtures.ts';
import { createSheetUiState, revealIn } from '../../shared/sheetUiState.ts';
import HeroSheet from '../HeroSheet.svelte';

function renderSheet() {
	const ui = $state(createSheetUiState('core'));
	const perform = vi.fn();
	const source = () => ({ actor: blankHero(), context: heroContext() });
	render(HeroSheet, { source, ui, perform });
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

const RAIL_LABEL = 'NIMBLE.actorSheet.hero.rail.label';

afterEach(() => vi.unstubAllGlobals());

describe('HeroSheet', () => {
	it('renders the rail and opens the Core tab', async () => {
		stubWidth(720);
		const { ui } = renderSheet();

		expect(screen.getByRole('complementary', { name: RAIL_LABEL })).toBeInTheDocument();
		await fireEvent.click(screen.getByRole('tab', { name: /tabs.core/ }));
		expect(ui.tab).toBe('core');
		expect(screen.getByText('NIMBLE.actorSheet.hero.core.abilitiesAndSaves')).toBeInTheDocument();
	});

	it('opens the Actions tab and the Spells tab', async () => {
		stubWidth(960);
		const { ui } = renderSheet();

		await fireEvent.click(screen.getByRole('tab', { name: /tabs.actions/ }));
		expect(ui.tab).toBe('actions');
		expect(document.querySelector('[data-row-id="heroic-defend"]')).not.toBeNull();
		expect(screen.getByRole('heading', { name: /groups.reactions/ })).toBeInTheDocument();

		await fireEvent.click(screen.getByRole('tab', { name: /tabs.spells/ }));
		expect(ui.tab).toBe('spells');
		expect(screen.getByText('NIMBLE.actorSheet.hero.spells.none')).toBeInTheDocument();
	});

	it.each([
		['features', 'NIMBLE.featureTypes.class'],
		['inventory', 'NIMBLE.actorSheet.hero.inventory.none'],
		['effects', 'NIMBLE.actorSheet.shared.effects.allConditions'],
		['bio', 'NIMBLE.actorSheet.hero.bio.notes'],
		['settings', 'NIMBLE.actorSheet.hero.settings.groups.image'],
	])('opens the %s tab', async (tab, text) => {
		stubWidth(720);
		const { ui } = renderSheet();

		await fireEvent.click(screen.getByRole('tab', { name: new RegExp(`tabs.${tab}`) }));

		expect(ui.tab).toBe(tab);
		expect(screen.getAllByText(text).length).toBeGreaterThan(0);
	});

	it('opens the choice step of a row that reveal() asks for', async () => {
		stubWidth(720);
		const { ui } = renderSheet();

		revealIn(ui, { tab: 'actions', rowId: 'heroic-assess', step: 'choice' });

		expect(
			await screen.findByRole('group', { name: 'NIMBLE.actorSheet.hero.actions.chooseOne' }),
		).toBeInTheDocument();
	});

	it('shows the narrow form below 560 px', () => {
		stubWidth(390);
		renderSheet();

		expect(screen.queryByRole('complementary', { name: RAIL_LABEL })).toBeNull();
		expect(screen.getByRole('banner', { name: RAIL_LABEL })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /NIMBLE.hitDice.heading/ })).toBeInTheDocument();
	});

	it('shows the edit band in edit mode, and Done leaves it', async () => {
		stubWidth(720);
		const { ui } = renderSheet();
		ui.editing = true;

		await fireEvent.click(
			await screen.findByRole('button', { name: 'NIMBLE.actorSheet.hero.frame.done' }),
		);

		expect(ui.editing).toBe(false);
	});

	it('flashes the row that reveal() asks for', async () => {
		stubWidth(720);
		const { ui } = renderSheet();

		revealIn(ui, { tab: 'core', rowId: 'skill-might', flash: true });

		await waitFor(() =>
			expect(
				document.querySelector('[data-row-id="skill-might"]')?.hasAttribute('data-flash'),
			).toBe(true),
		);
	});
});
