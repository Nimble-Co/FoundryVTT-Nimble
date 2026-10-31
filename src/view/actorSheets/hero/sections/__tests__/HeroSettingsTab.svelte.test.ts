import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import {
	blankHero,
	heroContext,
} from '../../../../../../tests/fixtures/actorSheets/heroFixtures.ts';
import { heroSettingsTab } from '../../heroSettingsTab.ts';
import HeroSettingsTab from '../HeroSettingsTab.svelte';

const SET = 'NIMBLE.actorSheet.hero.settings';

function renderTab() {
	const perform = vi.fn();
	render(HeroSettingsTab, { view: heroSettingsTab(blankHero(), heroContext()), perform });
	return { perform };
}

describe('HeroSettingsTab', () => {
	it('changes a setting out of edit mode too', async () => {
		const { perform } = renderTab();

		expect(screen.getByRole('switch', { name: `${SET}.passiveSkills` })).toBeEnabled();
		expect(screen.getByRole('spinbutton', { name: `${SET}.bonusSlots` })).toBeEnabled();
		expect(screen.getByRole('button', { name: `${SET}.resetSpellTier` })).toBeEnabled();
		await fireEvent.click(screen.getByRole('button', { name: 'NIMBLE.pdfExport.exportButton' }));
		expect(perform).toHaveBeenCalledWith({ kind: 'exportPdf' });
	});

	it('sets a flag from its switch, and tells what the switch does', async () => {
		const { perform } = renderTab();
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
		const { perform } = renderTab();
		const slots = screen.getByRole('spinbutton', { name: `${SET}.bonusSlots` });

		await fireEvent.change(slots, { target: { value: '-1' } });
		expect(perform).not.toHaveBeenCalled();
		await fireEvent.change(slots, { target: { value: '2' } });
		expect(perform).toHaveBeenCalledWith({ kind: 'setField', field: 'bonusSlots', value: 2 });
	});

	it('sets the Initiative bonus formula', async () => {
		const { perform } = renderTab();

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
		renderTab();
		const headings = screen.getAllByRole('heading').map((heading) => heading.textContent);

		expect(headings).not.toContain(`${SET}.groups.needsAPlace`);
		expect(screen.queryByRole('switch', { name: `${SET}.inspiration` })).toBeNull();
	});
});
