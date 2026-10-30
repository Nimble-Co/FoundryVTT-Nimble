/** What outside code asks the sheet to show: the macro deep link, a spend request, drop feedback. */
export interface RevealRequest {
	tab: string;
	rowId?: string;
	step?: 'choice';
	flash?: boolean;
}

/** The state of a sheet that is not on the actor. It lives on the Application, so it exists before mount. */
export interface SheetUiState {
	tab: string;
	editing: boolean;
	/** ids of the rows that show their text */
	openRows: string[];
	/** ids of the rows that hide their text, on a sheet where the text starts open */
	closedRows: string[];
	/** id of the row whose choice step is open */
	choiceStep: string | null;
	/** id of the ConfirmBar that asks now */
	confirm: string | null;
	/** a new serial flashes the row again */
	flash: { rowId: string; serial: number } | null;
}

export function createSheetUiState(tab: string): SheetUiState {
	return {
		tab,
		editing: false,
		openRows: [],
		closedRows: [],
		choiceStep: null,
		confirm: null,
		flash: null,
	};
}

export function revealIn(ui: SheetUiState, request: RevealRequest): void {
	ui.tab = request.tab;
	ui.confirm = null;
	if (!request.rowId) return;
	if (request.step === 'choice') ui.choiceStep = request.rowId;
	if (request.flash) ui.flash = { rowId: request.rowId, serial: (ui.flash?.serial ?? 0) + 1 };
}

/** Components change the UI state only here: a nested component that writes to an unbound prop gets a Svelte ownership warning. */

export function showTab(ui: SheetUiState, tab: string): void {
	ui.tab = tab;
	ui.confirm = null;
}

export function setEditing(ui: SheetUiState, editing: boolean): void {
	ui.editing = editing;
	ui.confirm = null;
}

export function askConfirm(ui: SheetUiState, confirmId: string): void {
	ui.confirm = confirmId;
}

export function closeConfirm(ui: SheetUiState): void {
	ui.confirm = null;
}

export function toggleRow(ui: SheetUiState, rowId: string): void {
	ui.openRows = ui.openRows.includes(rowId)
		? ui.openRows.filter((id) => id !== rowId)
		: [...ui.openRows, rowId];
}

/** Expand all gives every row id of the tab; Collapse all gives none. */
export function setOpenRows(ui: SheetUiState, rowIds: string[]): void {
	ui.openRows = [...rowIds];
}

export function toggleClosedRow(ui: SheetUiState, rowId: string): void {
	ui.closedRows = ui.closedRows.includes(rowId)
		? ui.closedRows.filter((id) => id !== rowId)
		: [...ui.closedRows, rowId];
}

/** Expand all gives none; Collapse all gives every row id of the tab. */
export function setClosedRows(ui: SheetUiState, rowIds: string[]): void {
	ui.closedRows = [...rowIds];
}

export function toggleChoice(ui: SheetUiState, rowId: string): void {
	ui.choiceStep = ui.choiceStep === rowId ? null : rowId;
	ui.confirm = null;
}

export function closeChoice(ui: SheetUiState): void {
	ui.choiceStep = null;
}
