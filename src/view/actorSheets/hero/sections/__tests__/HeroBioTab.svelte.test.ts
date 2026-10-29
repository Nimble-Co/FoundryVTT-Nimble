import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import {
	blankHero,
	heroContext,
} from '../../../../../../tests/fixtures/actorSheets/heroFixtures.ts';
import { createSheetUiState } from '../../../shared/sheetUiState.ts';
import { heroBioTab } from '../../heroBioTab.ts';
import HeroBioTab from '../HeroBioTab.svelte';

const BIO = 'NIMBLE.actorSheet.hero.bio';

function renderTab(editing: boolean, notes = '') {
	const ui = $state({ ...createSheetUiState('bio'), editing });
	const perform = vi.fn();
	const hero = blankHero({ system: { details: { age: '30', notes } } });
	render(HeroBioTab, {
		view: heroBioTab(hero, heroContext({ enrichedNotes: notes })),
		ui,
		perform,
	});
	return { perform };
}

describe('HeroBioTab', () => {
	it('changes a detail only in edit mode', async () => {
		renderTab(false);
		expect(screen.getByRole('textbox', { name: `${BIO}.age` })).toBeDisabled();
	});

	it('sends the new value of a detail', async () => {
		const { perform } = renderTab(true);

		await fireEvent.change(screen.getByRole('textbox', { name: `${BIO}.height` }), {
			target: { value: '6 ft' },
		});

		expect(perform).toHaveBeenCalledWith({ kind: 'setDetail', detail: 'height', value: '6 ft' });
	});

	it('gives the notes editor its field, its value and the enriched text', () => {
		renderTab(true, '<p>Old & "new"</p>');
		const editor = document.querySelector('prose-mirror');

		expect(editor?.getAttribute('name')).toBe('system.details.notes');
		expect(editor?.getAttribute('value')).toBe('<p>Old & "new"</p>');
		expect(editor?.hasAttribute('toggled')).toBe(true);
		expect(editor?.hasAttribute('disabled')).toBe(false);
		expect(editor?.innerHTML).toBe('<p>Old &amp; "new"</p>');
	});

	it('shows the editor read-only out of edit mode, and says so when there are no notes', () => {
		renderTab(false);
		expect(screen.getByText(`${BIO}.noNotes`)).toBeInTheDocument();
	});
});
