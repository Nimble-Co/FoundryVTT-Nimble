import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import {
	blankHero,
	heroContext,
	manaCaster,
} from '../../../../../../tests/fixtures/actorSheets/heroFixtures.ts';
import { createSheetUiState } from '../../../shared/sheetUiState.ts';
import type { HeroActorLike } from '../../heroSource.ts';
import { heroSpellsTab } from '../../heroSpellsTab.ts';
import HeroSpellsTab from '../HeroSpellsTab.svelte';

const SPELLS = 'NIMBLE.actorSheet.hero.spells';

function renderTab(actor: HeroActorLike = manaCaster(), editing = false) {
	const ui = $state({ ...createSheetUiState('spells'), editing });
	const perform = vi.fn();
	render(HeroSpellsTab, { view: heroSpellsTab(actor, heroContext()), ui, perform });
	return { ui, perform };
}

describe('HeroSpellsTab', () => {
	it('groups the spells by tier, and the switch asks for By school', async () => {
		const { perform } = renderTab();

		expect(screen.getAllByRole('heading').map((heading) => heading.textContent)).toEqual([
			'NIMBLE.spells.tierHeadings.tier0',
			'NIMBLE.spells.tierHeadings.tier1',
		]);
		await fireEvent.click(
			screen.getByRole('button', { name: `${SPELLS}.bySchool`, pressed: false }),
		);

		expect(perform).toHaveBeenCalledWith({ kind: 'setSpellsBy', value: 'school' });
	});

	it('casts a spell from its row', async () => {
		const { perform } = renderTab();

		await fireEvent.click(screen.getByRole('button', { name: /actions\.cast.*Ignite/ }));

		expect(perform).toHaveBeenCalledWith({ kind: 'activate', itemId: 'ignite' });
	});

	it('shows Create Spell only in edit mode', async () => {
		renderTab();
		expect(screen.queryByRole('button', { name: `${SPELLS}.create` })).toBeNull();
	});

	it('creates a spell in edit mode', async () => {
		const { perform } = renderTab(manaCaster(), true);

		await fireEvent.click(screen.getByRole('button', { name: `${SPELLS}.create` }));

		expect(perform).toHaveBeenCalledWith({ kind: 'createItem', itemType: 'spell' });
	});

	it('shows the empty note for a hero with no spells', () => {
		renderTab(blankHero());

		expect(screen.getByText(`${SPELLS}.none`)).toBeInTheDocument();
		expect(screen.queryAllByRole('heading')).toHaveLength(0);
	});

	it('opens every spell with Expand all', async () => {
		const { ui } = renderTab();

		await fireEvent.click(screen.getByRole('button', { name: 'Expand all' }));

		expect([...ui.openRows].sort()).toEqual(
			['chillcraft', 'flameDart', 'frostShield', 'iceLance', 'ignite'].sort(),
		);
	});
});
