import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import {
	blankHero,
	effectsContext,
	effectsHero,
	heroContext,
} from '../../../../../../tests/fixtures/actorSheets/heroFixtures.ts';
import { createSheetUiState } from '../../../shared/sheetUiState.ts';
import { heroEffectsTab } from '../../heroEffectsTab.ts';
import HeroEffectsTab from '../HeroEffectsTab.svelte';

const FX = 'NIMBLE.actorSheet.hero.effects';

function renderTab(view = heroEffectsTab(effectsHero(), effectsContext())) {
	const ui = $state(createSheetUiState('effects'));
	const perform = vi.fn();
	render(HeroEffectsTab, { view, ui, perform });
	return { ui, perform };
}

describe('HeroEffectsTab', () => {
	it('ends a toggle effect on a click, with no question', async () => {
		const { perform } = renderTab();

		await fireEvent.click(screen.getByRole('button', { name: /shared\.endName.*Rage/ }));

		expect(perform).toHaveBeenCalledWith({ kind: 'endEffect', effectId: 'rageEffect' });
		expect(screen.queryByRole('alertdialog')).toBeNull();
	});

	it('asks before it removes an effect, and removes it on Yes', async () => {
		const { perform } = renderTab();
		const bless = screen.getByRole('button', { name: `${FX}.removeName {"name":"Bless"}` });

		await fireEvent.click(bless);
		expect(bless).toHaveAttribute('aria-expanded', 'true');
		expect(perform).not.toHaveBeenCalled();
		await fireEvent.click(screen.getByRole('button', { name: `${FX}.remove` }));

		expect(perform).toHaveBeenCalledWith({ kind: 'removeEffect', effectId: 'bless', itemId: null });
		expect(screen.queryByRole('alertdialog')).toBeNull();
	});

	it('asks before it removes a condition on you', async () => {
		const { perform } = renderTab();

		await fireEvent.click(
			screen.getByRole('button', { name: new RegExp(`${FX}.removeName.*Dazed`) }),
		);
		await fireEvent.click(screen.getByRole('button', { name: `${FX}.remove` }));

		expect(perform).toHaveBeenCalledWith({
			kind: 'setCondition',
			conditionId: 'dazed',
			active: false,
		});
	});

	it('turns a condition on from the grid', async () => {
		const { perform } = renderTab();

		await fireEvent.click(screen.getByRole('button', { name: 'Prone', pressed: false }));

		expect(perform).toHaveBeenCalledWith({
			kind: 'setCondition',
			conditionId: 'prone',
			active: true,
		});
		expect(screen.getByRole('button', { name: 'Dazed', pressed: true })).toBeInTheDocument();
	});

	it('moves the focus in the condition grid with the arrow keys, Home and End', async () => {
		renderTab();
		const dazed = screen.getByRole('button', { name: 'Dazed', pressed: true });
		const prone = screen.getByRole('button', { name: 'Prone' });
		dazed.focus();

		await fireEvent.keyDown(dazed, { key: 'ArrowRight' });
		expect(document.activeElement).toBe(prone);
		await fireEvent.keyDown(prone, { key: 'Home' });
		expect(document.activeElement).toBe(dazed);
		await fireEvent.keyDown(dazed, { key: 'End' });
		expect(document.activeElement).toBe(prone);
	});

	it('says None in each empty group', () => {
		renderTab(heroEffectsTab(blankHero(), heroContext()));

		expect(screen.getAllByText(`${FX}.none`)).toHaveLength(3);
	});
});
