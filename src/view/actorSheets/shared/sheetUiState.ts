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
	/** id of the row whose choice step is open */
	choiceStep: string | null;
	/** id of the ConfirmBar that asks now */
	confirm: string | null;
	/** a new serial flashes the row again */
	flash: { rowId: string; serial: number } | null;
}

export function createSheetUiState(tab: string): SheetUiState {
	return { tab, editing: false, openRows: [], choiceStep: null, confirm: null, flash: null };
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
