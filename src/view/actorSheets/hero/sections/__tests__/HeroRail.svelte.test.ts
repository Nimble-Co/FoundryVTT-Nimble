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

const RAIL = 'NIMBLE.actorSheet.hero.rail';

function renderRail(context: Partial<HeroSheetContext> = {}, editing = false) {
	const ui = $state({ ...createSheetUiState('core'), editing });
	const perform = vi.fn();
	const view = heroRail(blankHero({ system: { levelUpHistory: [{}] } }), heroContext(context));
	render(HeroRail, { view, ui, perform });
	return { ui, perform };
}

describe('HeroRail', () => {
	it('gives Inspiration from the seal on the portrait, also in edit mode', async () => {
		const { perform } = renderRail({}, true);
		const seal = screen.getByRole('button', { name: `${RAIL}.inspiration.label` });

		expect(seal).toHaveAttribute('aria-pressed', 'false');
		expect(seal).toHaveAttribute('data-tooltip', `${RAIL}.inspiration.off`);
		await fireEvent.click(seal);
		expect(perform).toHaveBeenCalledWith({ kind: 'setInspiration', value: true });
	});

	it('sends the intent of a wound segment', async () => {
		const { perform } = renderRail();

		await fireEvent.click(screen.getByRole('button', { name: /toggleWound {"number":"2"}/ }));

		expect(perform).toHaveBeenCalledWith({ kind: 'setWounds', value: 2 });
	});

	it('types a new HP value', async () => {
		const { perform } = renderRail();
		const hp = screen.getByRole('spinbutton', { name: /vitalPlate\.hp$/ });

		await fireEvent.input(hp, { target: { value: '12' } });
		await fireEvent.blur(hp);

		expect(perform).toHaveBeenCalledWith({ kind: 'setHp', value: 12 });
	});

	it('shows the rests out of combat, and not in combat', async () => {
		const { perform } = renderRail();
		await fireEvent.click(screen.getByRole('button', { name: 'NIMBLE.prompts.fieldRest' }));
		expect(perform).toHaveBeenCalledWith({ kind: 'rest', restType: 'field' });
	});

	it('hides the rests in combat and keeps Roll Initiative', () => {
		renderRail({ combat: heroTurn() });

		expect(screen.queryByRole('button', { name: 'NIMBLE.prompts.fieldRest' })).toBeNull();
		expect(screen.queryByRole('button', { name: 'NIMBLE.prompts.safeRest' })).toBeNull();
		expect(screen.getByRole('button', { name: /prompts.rollInitiative/ })).toBeInTheDocument();
	});

	it('shows Level Up in play, and Revert Last Level Up only in edit mode', async () => {
		const { ui, perform } = renderRail();

		expect(screen.getByRole('button', { name: 'NIMBLE.prompts.levelUp' })).toBeEnabled();
		expect(screen.queryByRole('button', { name: `${RAIL}.revertLevelUp` })).toBeNull();
		await fireEvent.click(screen.getByRole('button', { name: 'NIMBLE.prompts.levelUp' }));
		expect(perform).toHaveBeenCalledWith({ kind: 'levelUp' });

		await fireEvent.click(screen.getByRole('button', { name: `${RAIL}.edit`, pressed: false }));
		expect(ui.editing).toBe(true);
		await fireEvent.click(screen.getByRole('button', { name: `${RAIL}.revertLevelUp` }));
		expect(perform).toHaveBeenCalledWith({ kind: 'revertLevelUp' });
	});

	it('asks before End turn while actions are left, and sends nothing until you confirm', async () => {
		const { perform } = renderRail({ combat: heroTurn() });

		await fireEvent.click(screen.getByRole('button', { name: 'NIMBLE.ui.heroicActions.endTurn' }));
		expect(perform).not.toHaveBeenCalled();
		expect(screen.getByRole('alertdialog')).toBeInTheDocument();

		await fireEvent.click(screen.getByRole('button', { name: 'NIMBLE.ui.heroicActions.endTurn' }));
		expect(perform).toHaveBeenCalledWith({ kind: 'endTurn' });
	});

	it('changes the UI state from a nested section with no Svelte ownership warning', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		renderRail({
			combat: heroTurn(),
			dicePools: [{ id: 'fury', label: 'Fury Dice', dieSize: 'd6', max: 3, faces: [4, 2] }],
		});

		await fireEvent.click(screen.getByRole('button', { name: 'NIMBLE.ui.heroicActions.endTurn' }));
		await fireEvent.click(screen.getByRole('button', { name: 'NIMBLE.ui.heroicActions.endTurn' }));
		await fireEvent.click(
			screen.getByRole('button', { name: 'NIMBLE.actorSheet.hero.meter.discardAll' }),
		);
		await fireEvent.click(
			screen.getAllByRole('button', { name: 'NIMBLE.actorSheet.hero.meter.discardAll' }).at(-1)!,
		);
		await fireEvent.click(screen.getByRole('button', { name: `${RAIL}.edit`, pressed: false }));

		expect(warn.mock.calls.flat().join('\n')).not.toMatch(/ownership_invalid_mutation/);
		warn.mockRestore();
	});

	it('shows what the next turn gains', () => {
		renderRail({ combat: heroTurn({ actions: { pendingDelta: 2 } }) });

		expect(screen.getByText(/NIMBLE.ui.heroicActions.pendingActionsGain/)).toBeInTheDocument();
	});

	it('opens a configure window from an outline in edit mode', async () => {
		const { perform } = renderRail({}, true);

		await fireEvent.click(screen.getByRole('button', { name: `${RAIL}.configureHp` }));

		expect(perform).toHaveBeenCalledWith({ kind: 'configure', target: 'hitPoints' });
	});

	it('opens the level correction from the warning', async () => {
		const { perform } = renderRail({ missingLevelSelections: [2] });

		await fireEvent.click(
			screen.getByRole('button', { name: /levelCorrectionDialog.sheetWarning/ }),
		);

		expect(perform).toHaveBeenCalledWith({ kind: 'correctLevels' });
	});

	it('rolls Initiative', async () => {
		const { perform } = renderRail();

		await fireEvent.click(screen.getByRole('button', { name: /prompts.rollInitiative/ }));

		expect(perform).toHaveBeenCalledWith({ kind: 'rollInitiative' });
	});

	it('spends an action from its cell and adds an extra action', async () => {
		const { perform } = renderRail({ combat: heroTurn({ actions: { current: 2 } }) });

		await fireEvent.click(screen.getByRole('button', { name: /spendAction {"number":"1"}/ }));
		expect(perform).toHaveBeenCalledWith({ kind: 'setActions', value: 1 });

		await fireEvent.click(
			screen.getByRole('button', { name: 'NIMBLE.ui.heroicActions.addAdditionalAction' }),
		);
		expect(perform).toHaveBeenCalledWith({ kind: 'addAction' });
	});

	it('types a new temp HP value', async () => {
		const { perform } = renderRail();
		const temp = screen.getByRole('spinbutton', { name: 'Temp HP' });

		await fireEvent.input(temp, { target: { value: '4' } });
		await fireEvent.blur(temp);

		expect(perform).toHaveBeenCalledWith({ kind: 'setTempHp', value: 4 });
	});

	it('renames the hero and changes the portrait in edit mode', async () => {
		const { perform } = renderRail({}, true);

		await fireEvent.change(screen.getByRole('textbox', { name: `${RAIL}.name` }), {
			target: { value: 'Ash' },
		});
		await fireEvent.click(screen.getByRole('button', { name: 'NIMBLE.prompts.changeActorImage' }), {
			shiftKey: true,
		});

		expect(perform).toHaveBeenCalledWith({ kind: 'rename', name: 'Ash' });
		expect(perform).toHaveBeenCalledWith({ kind: 'changePortrait', skipTokenizer: true });
	});

	it('shows the fallback portrait when the image does not load', async () => {
		renderRail();
		const portrait = screen.getByRole('img', { name: 'Blank Hero' });

		await fireEvent.error(portrait);

		expect(portrait.getAttribute('src')).toBe('icons/svg/mystery-man.svg');
	});
});
