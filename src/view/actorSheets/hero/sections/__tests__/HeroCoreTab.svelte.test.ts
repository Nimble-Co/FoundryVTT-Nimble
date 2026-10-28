import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import {
	blankHero,
	heroContext,
} from '../../../../../../tests/fixtures/actorSheets/heroFixtures.ts';
import { heroCoreTab } from '../../heroCoreTab.ts';
import HeroCoreTab from '../HeroCoreTab.svelte';

function renderCore(editing = false) {
	const perform = vi.fn();
	const view = heroCoreTab(blankHero(), heroContext());
	render(HeroCoreTab, { view, editing, perform, skillColumns: 2 });
	return { perform };
}

describe('HeroCoreTab', () => {
	it('rolls a skill, an ability check and a save', async () => {
		const { perform } = renderCore();

		await fireEvent.click(screen.getByRole('button', { name: /NIMBLE.skills.stealth/ }));
		expect(perform).toHaveBeenCalledWith({ kind: 'rollSkill', skill: 'stealth' });

		const checks = screen.getAllByRole('button', { name: /NIMBLE.abilityScores.will/ });
		await fireEvent.click(checks[0]);
		await fireEvent.click(checks[1]);
		expect(perform).toHaveBeenCalledWith({ kind: 'rollAbilityCheck', ability: 'will' });
		expect(perform).toHaveBeenCalledWith({ kind: 'rollSave', save: 'will' });
	});

	it('marks the advantage that rules give to a save', () => {
		renderCore();

		expect(screen.getAllByRole('img', { name: 'Advantage × 1' })).toHaveLength(1);
		expect(screen.getAllByRole('img', { name: 'Disadvantage × 1' })).toHaveLength(1);
	});

	it('rests the rolls and shows the configure controls in edit mode', async () => {
		const { perform } = renderCore(true);

		expect(screen.getByRole('button', { name: /NIMBLE.skills.stealth/ })).toBeDisabled();
		await fireEvent.click(screen.getByRole('button', { name: 'Configure Stats' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Configure Saves' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Configure Skills' }));
		await fireEvent.click(
			screen.getByRole('button', { name: /Configure NIMBLE.actorSheet.hero.core.languages/ }),
		);

		expect(perform.mock.calls.map(([intent]) => intent.target)).toEqual([
			'abilities',
			'saves',
			'skills',
			'languages',
		]);
	});

	it('has no configure controls in play', () => {
		renderCore();

		expect(screen.queryByRole('button', { name: /^Configure/ })).toBeNull();
	});
});
