import { describe, expect, it } from 'vitest';
import { createSheetUiState, revealIn } from '../sheetUiState.ts';

describe('revealIn', () => {
	it('goes to the tab', () => {
		const ui = createSheetUiState('core');
		revealIn(ui, { tab: 'actions' });

		expect(ui.tab).toBe('actions');
		expect(ui.flash).toBeNull();
		expect(ui.choiceStep).toBeNull();
	});

	it('opens the choice step of the row', () => {
		const ui = createSheetUiState('core');
		revealIn(ui, { tab: 'actions', rowId: 'assess', step: 'choice' });

		expect(ui.choiceStep).toBe('assess');
	});

	it('flashes the row, and flashes it again on a second reveal', () => {
		const ui = createSheetUiState('core');
		revealIn(ui, { tab: 'inventory', rowId: 'rope', flash: true });
		const first = ui.flash;
		revealIn(ui, { tab: 'inventory', rowId: 'rope', flash: true });

		expect(first?.rowId).toBe('rope');
		expect(ui.flash?.rowId).toBe('rope');
		expect(ui.flash?.serial).not.toBe(first?.serial);
	});

	it('closes a confirm bar that the reveal moves away from', () => {
		const ui = createSheetUiState('core');
		ui.confirm = 'endTurn';
		revealIn(ui, { tab: 'spells' });

		expect(ui.confirm).toBeNull();
	});
});
