import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import {
	blankHero,
	heroContext,
	heroTurn,
} from '../../../../../../tests/fixtures/actorSheets/heroFixtures.ts';
import { createSheetUiState } from '../../../shared/sheetUiState.ts';
import { heroRail } from '../../heroRail.ts';
import type { HeroSheetContext } from '../../heroSource.ts';
import HeroRail from '../HeroRail.svelte';

function renderRail(context: Partial<HeroSheetContext> = {}, editing = false) {
	const ui = $state({ ...createSheetUiState('core'), editing });
	const perform = vi.fn();
	const view = heroRail(blankHero({ system: { levelUpHistory: [{}] } }), heroContext(context));
	render(HeroRail, { view, ui, perform });
	return { ui, perform };
}

describe('HeroRail', () => {
	it('sends the intent of a wound segment', async () => {
		const { perform } = renderRail();

		await fireEvent.click(screen.getByRole('button', { name: /toggleWound {"number":"2"}/ }));

		expect(perform).toHaveBeenCalledWith({ kind: 'setWounds', value: 2 });
	});

	it('types a new HP value', async () => {
		const { perform } = renderRail();
		const hp = screen.getByRole('spinbutton', { name: 'Current HP' });

		await fireEvent.input(hp, { target: { value: '12' } });
		await fireEvent.blur(hp);

		expect(perform).toHaveBeenCalledWith({ kind: 'setHp', value: 12 });
	});

	it('shows the rests out of combat, and not in combat', async () => {
		const { perform } = renderRail();
		await fireEvent.click(screen.getByRole('button', { name: /Field Rest/ }));
		expect(perform).toHaveBeenCalledWith({ kind: 'rest', restType: 'field' });
	});

	it('hides the rests in combat and keeps Roll Initiative', () => {
		renderRail({ combat: heroTurn() });

		expect(screen.queryByRole('button', { name: /Field Rest/ })).toBeNull();
		expect(screen.queryByRole('button', { name: /Safe Rest/ })).toBeNull();
		expect(screen.getByRole('button', { name: /prompts.rollInitiative/ })).toBeInTheDocument();
	});

	it('shows Level Up in play, and Revert Last Level Up only in edit mode', async () => {
		const { ui, perform } = renderRail();

		expect(screen.getByRole('button', { name: /Level Up/ })).toBeEnabled();
		expect(screen.queryByRole('button', { name: 'Revert Last Level Up' })).toBeNull();
		await fireEvent.click(screen.getByRole('button', { name: /Level Up/ }));
		expect(perform).toHaveBeenCalledWith({ kind: 'levelUp' });

		await fireEvent.click(screen.getByRole('button', { name: 'Edit', pressed: false }));
		expect(ui.editing).toBe(true);
		await fireEvent.click(screen.getByRole('button', { name: 'Revert Last Level Up' }));
		expect(perform).toHaveBeenCalledWith({ kind: 'revertLevelUp' });
	});

	it('asks before End turn while actions are left, and sends nothing until you confirm', async () => {
		const { perform } = renderRail({ combat: heroTurn() });

		await fireEvent.click(screen.getByRole('button', { name: /End Turn/ }));
		expect(perform).not.toHaveBeenCalled();
		expect(screen.getByRole('alertdialog')).toBeInTheDocument();

		await fireEvent.click(screen.getByRole('button', { name: 'End Turn' }));
		expect(perform).toHaveBeenCalledWith({ kind: 'endTurn' });
	});

	it('shows what the next turn gains', () => {
		renderRail({ combat: heroTurn({ actions: { pendingDelta: 2 } }) });

		expect(screen.getByText(/NIMBLE.ui.heroicActions.pendingActionsGain/)).toBeInTheDocument();
	});

	it('opens a configure window from an outline in edit mode', async () => {
		const { perform } = renderRail({}, true);

		await fireEvent.click(screen.getByRole('button', { name: 'Configure Hit Points' }));

		expect(perform).toHaveBeenCalledWith({ kind: 'configure', target: 'hitPoints' });
	});

	it('opens the level correction from the warning', async () => {
		const { perform } = renderRail({ missingLevelSelections: [2] });

		await fireEvent.click(
			screen.getByRole('button', { name: /levelCorrectionDialog.sheetWarning/ }),
		);

		expect(perform).toHaveBeenCalledWith({ kind: 'correctLevels' });
	});
});
