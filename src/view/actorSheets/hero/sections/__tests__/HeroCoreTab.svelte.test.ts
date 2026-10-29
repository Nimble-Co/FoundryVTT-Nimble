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

		await fireEvent.click(screen.getByRole('button', { name: /rollAbilityCheckSpecific.*will/ }));
		await fireEvent.click(screen.getByRole('button', { name: /rollSavingThrowSpecific.*will/ }));
		expect(perform).toHaveBeenCalledWith({ kind: 'rollAbilityCheck', ability: 'will' });
		expect(perform).toHaveBeenCalledWith({ kind: 'rollSave', save: 'will' });
	});

	it('marks the advantage that rules give to a save', () => {
		renderCore();

		expect(screen.getAllByRole('img', { name: /rollMode\.advantage {"count":"1"}/ })).toHaveLength(
			1,
		);
		expect(
			screen.getAllByRole('img', { name: /rollMode\.disadvantage {"count":"1"}/ }),
		).toHaveLength(1);
	});

	it('rests the rolls and shows the configure controls in edit mode', async () => {
		const { perform } = renderCore(true);

		expect(screen.getByRole('button', { name: /NIMBLE.skills.stealth/ })).toBeDisabled();
		await fireEvent.click(
			screen.getByRole('button', { name: 'NIMBLE.prompts.configureAbilityScores' }),
		);
		await fireEvent.click(
			screen.getByRole('button', { name: 'NIMBLE.prompts.configureSavingThrows' }),
		);
		await fireEvent.click(screen.getByRole('button', { name: 'NIMBLE.prompts.configureSkills' }));
		await fireEvent.click(
			screen.getByRole('button', { name: 'NIMBLE.prompts.configureLanguageProficiencies' }),
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

		expect(screen.queryByRole('button', { name: /NIMBLE\.prompts\.configure/ })).toBeNull();
	});
});
