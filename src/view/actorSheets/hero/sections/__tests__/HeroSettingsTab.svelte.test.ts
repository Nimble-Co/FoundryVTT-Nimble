import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import {
	blankHero,
	heroContext,
} from '../../../../../../tests/fixtures/actorSheets/heroFixtures.ts';
import { createSheetUiState } from '../../../shared/sheetUiState.ts';
import { heroSettingsTab } from '../../heroSettingsTab.ts';
import HeroSettingsTab from '../HeroSettingsTab.svelte';

const SET = 'NIMBLE.actorSheet.hero.settings';

function renderTab(editing: boolean) {
	const ui = $state({ ...createSheetUiState('settings'), editing });
	const perform = vi.fn();
	render(HeroSettingsTab, { view: heroSettingsTab(blankHero(), heroContext()), ui, perform });
	return { perform };
}

describe('HeroSettingsTab', () => {
	it('changes a setting only in edit mode, and exports in all modes', async () => {
		const { perform } = renderTab(false);

		expect(screen.getByRole('switch', { name: `${SET}.passiveSkills` })).toBeDisabled();
		expect(screen.getByRole('button', { name: `${SET}.resetSpellTier` })).toBeDisabled();
		await fireEvent.click(screen.getByRole('button', { name: 'NIMBLE.pdfExport.exportButton' }));
		expect(perform).toHaveBeenCalledWith({ kind: 'exportPdf' });
	});

	it('sets a flag from its switch, and tells what the switch does', async () => {
		const { perform } = renderTab(true);
		const passive = screen.getByRole('switch', { name: `${SET}.passiveSkills` });

		expect(passive).toHaveAccessibleDescription(`${SET}.hints.passiveSkills`);
		await fireEvent.click(passive);

		expect(perform).toHaveBeenCalledWith({
			kind: 'setFlag',
			flag: 'showPassiveSkillScores',
			value: true,
		});
	});

	it('sets a number, and ignores one below its minimum', async () => {
		const { perform } = renderTab(true);
		const slots = screen.getByRole('spinbutton', { name: `${SET}.bonusSlots` });

		await fireEvent.change(slots, { target: { value: '-1' } });
		expect(perform).not.toHaveBeenCalled();
		await fireEvent.change(slots, { target: { value: '2' } });
		expect(perform).toHaveBeenCalledWith({ kind: 'setField', field: 'bonusSlots', value: 2 });
	});

	it('sets the Initiative bonus formula', async () => {
		const { perform } = renderTab(true);

		await fireEvent.change(screen.getByRole('textbox', { name: `${SET}.initiativeBonus` }), {
			target: { value: '1d4' },
		});

		expect(perform).toHaveBeenCalledWith({
			kind: 'setField',
			field: 'initiativeBonuses',
			value: '1d4',
		});
	});

	it('shows no Needs a place group when it has no entry', () => {
		renderTab(true);
		const headings = screen.getAllByRole('heading').map((heading) => heading.textContent);

		expect(headings).not.toContain(`${SET}.groups.needsAPlace`);
		expect(screen.queryByRole('switch', { name: `${SET}.inspiration` })).toBeNull();
	});
});
