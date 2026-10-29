import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import {
	blankHero,
	featureHero,
	heroContext,
} from '../../../../../../tests/fixtures/actorSheets/heroFixtures.ts';
import { createSheetUiState } from '../../../shared/sheetUiState.ts';
import { heroFeaturesTab } from '../../heroFeaturesTab.ts';
import type { HeroActorLike } from '../../heroSource.ts';
import HeroFeaturesTab from '../HeroFeaturesTab.svelte';

const FEAT = 'NIMBLE.actorSheet.hero.features';

function renderTab(actor: HeroActorLike = featureHero(), editing = false) {
	const ui = $state({ ...createSheetUiState('features'), editing });
	const perform = vi.fn();
	render(HeroFeaturesTab, { view: heroFeaturesTab(actor, heroContext()), ui, perform });
	return { ui, perform };
}

describe('HeroFeaturesTab', () => {
	it('shows the class with its subheadings, then the ancestry, the background and the boons', () => {
		renderTab();

		expect(screen.getAllByRole('heading').map((heading) => heading.textContent)).toEqual([
			'NIMBLE.featureTypes.class',
			'Path of the Red Mist',
			'Savage Arsenal',
			'NIMBLE.featureTypeHeadings.ancestry',
			'NIMBLE.featureTypeHeadings.background',
			'NIMBLE.featureTypeHeadings.boon',
		]);
	});

	it('posts a passive feature to chat from its row', async () => {
		const { perform } = renderTab();

		await fireEvent.click(
			screen.getByRole('button', { name: new RegExp(`${FEAT}.post.*Quick Tempered`) }),
		);

		expect(perform).toHaveBeenCalledWith({ kind: 'activate', itemId: 'quickTempered' });
	});

	it('shows Create Feature only in edit mode', async () => {
		renderTab(blankHero());
		expect(screen.queryByRole('button', { name: `${FEAT}.create` })).toBeNull();
	});

	it('creates a feature in edit mode', async () => {
		const { perform } = renderTab(blankHero(), true);

		await fireEvent.click(screen.getByRole('button', { name: `${FEAT}.create` }));

		expect(perform).toHaveBeenCalledWith({ kind: 'createItem', itemType: 'feature' });
	});

	it('opens the rows under the subheadings too with Expand all', async () => {
		const { ui } = renderTab();

		await fireEvent.click(screen.getByRole('button', { name: 'Expand all' }));

		expect(ui.openRows).toContain('bloodlust');
		expect(ui.openRows).toContain('mightyEndurance');
		expect(ui.openRows).toContain('boonLuck');
	});
});
