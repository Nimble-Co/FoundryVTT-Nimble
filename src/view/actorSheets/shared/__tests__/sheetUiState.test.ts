import { describe, expect, it } from 'vitest';
import {
	askConfirm,
	closeChoice,
	closeConfirm,
	createSheetUiState,
	isCardOpen,
	revealIn,
	setCardsOpen,
	setCardsStartOpen,
	setClosedRows,
	setEditing,
	setOpenRows,
	showTab,
	toggleCard,
	toggleChoice,
	toggleClosedRow,
	toggleRow,
} from '../sheetUiState.ts';

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

describe('the UI state changes', () => {
	it('closes the ConfirmBar when the tab or the edit mode changes', () => {
		const ui = createSheetUiState('core');
		askConfirm(ui, 'endTurn');
		showTab(ui, 'actions');

		expect(ui).toMatchObject({ tab: 'actions', confirm: null });

		askConfirm(ui, 'endTurn');
		setEditing(ui, true);

		expect(ui).toMatchObject({ editing: true, confirm: null });
	});

	it('opens and closes a ConfirmBar', () => {
		const ui = createSheetUiState('core');
		askConfirm(ui, 'discardAll:fury');

		expect(ui.confirm).toBe('discardAll:fury');

		closeConfirm(ui);

		expect(ui.confirm).toBeNull();
	});
});

describe('rows and choice steps', () => {
	it('opens and closes the text of one row', () => {
		const ui = createSheetUiState('actions');
		toggleRow(ui, 'rage');
		toggleRow(ui, 'move');
		toggleRow(ui, 'rage');

		expect(ui.openRows).toEqual(['move']);
	});

	it('opens all the rows of a tab, or closes them', () => {
		const ui = createSheetUiState('actions');
		setOpenRows(ui, ['a', 'b']);

		expect(ui.openRows).toEqual(['a', 'b']);

		setOpenRows(ui, []);

		expect(ui.openRows).toEqual([]);
	});

	it('closes and opens the text of one row on a sheet where the text starts open', () => {
		const ui = createSheetUiState('abilities');
		toggleClosedRow(ui, 'bite');
		toggleClosedRow(ui, 'claw');
		toggleClosedRow(ui, 'bite');

		expect(ui.closedRows).toEqual(['claw']);
		expect(ui.openRows).toEqual([]);
	});

	it('closes all the rows of a tab where the text starts open, or opens them', () => {
		const ui = createSheetUiState('abilities');
		setClosedRows(ui, ['bite', 'claw']);

		expect(ui.closedRows).toEqual(['bite', 'claw']);

		setClosedRows(ui, []);

		expect(ui.closedRows).toEqual([]);
	});

	it.each([
		[true, ['bite'], 'closedRows'],
		[false, ['claw'], 'openRows'],
	] as const)(
		'cards that start open (%s): one click on each changes it, and the list keeps the exceptions',
		(startOpen, exceptions, list) => {
			const ui = createSheetUiState('abilities');
			ui.cardsStartOpen = startOpen;

			expect(isCardOpen(ui, 'bite')).toBe(startOpen);
			toggleCard(ui, exceptions[0]);

			expect(isCardOpen(ui, 'bite')).toBe(false);
			expect(isCardOpen(ui, 'claw')).toBe(true);
			expect(ui[list]).toEqual(exceptions);
		},
	);

	it.each([true, false])(
		'Expand all and Collapse all of the cards, when cards start open is %s',
		(startOpen) => {
			const ui = createSheetUiState('abilities');
			ui.cardsStartOpen = startOpen;

			setCardsOpen(ui, ['bite', 'claw'], false);
			expect([isCardOpen(ui, 'bite'), isCardOpen(ui, 'claw')]).toEqual([false, false]);

			setCardsOpen(ui, ['bite', 'claw'], true);
			expect([isCardOpen(ui, 'bite'), isCardOpen(ui, 'claw')]).toEqual([true, true]);
		},
	);

	it('Expand all of the cards keeps the open rows of the other tabs', () => {
		const ui = createSheetUiState('abilities');
		ui.cardsStartOpen = false;
		ui.openRows = ['effect-1'];

		setCardsOpen(ui, ['bite', 'claw'], true);
		expect(ui.openRows).toEqual(['effect-1', 'bite', 'claw']);

		setCardsOpen(ui, ['bite', 'claw'], false);
		expect(ui.openRows).toEqual(['effect-1']);
	});

	it('a change of where the cards start forgets the cards opened or closed by hand', () => {
		const ui = createSheetUiState('abilities');
		ui.closedRows = ['bite'];

		setCardsStartOpen(ui, true);
		expect(ui.closedRows).toEqual(['bite']);

		setCardsStartOpen(ui, false);
		expect(ui.cardsStartOpen).toBe(false);
		expect([ui.openRows, ui.closedRows]).toEqual([[], []]);
	});

	it('opens one choice step at a time, and a second click closes it', () => {
		const ui = createSheetUiState('actions');
		askConfirm(ui, 'endTurn');
		toggleChoice(ui, 'heroic-assess');

		expect(ui).toMatchObject({ choiceStep: 'heroic-assess', confirm: null });

		toggleChoice(ui, 'heroic-defend');

		expect(ui.choiceStep).toBe('heroic-defend');

		toggleChoice(ui, 'heroic-defend');

		expect(ui.choiceStep).toBeNull();
	});

	it('closes the choice step', () => {
		const ui = createSheetUiState('actions');
		toggleChoice(ui, 'bloodlust');
		closeChoice(ui);

		expect(ui.choiceStep).toBeNull();
	});
});
