export const MINION_GROUPING_MODE_CANVAS_LITE = 'canvasLite';
export type MinionGroupingMode = typeof MINION_GROUPING_MODE_CANVAS_LITE;

export function normalizeMinionGroupingMode(value: unknown): MinionGroupingMode {
	void value;
	return MINION_GROUPING_MODE_CANVAS_LITE;
}

export function getConfiguredMinionGroupingMode(): MinionGroupingMode {
	return MINION_GROUPING_MODE_CANVAS_LITE;
}

export function shouldUseCanvasLiteTemporaryGroups(): boolean {
	return true;
}

export function shouldShowTrackerGroupingControlsForCurrentUser(): boolean {
	return false;
}

export function shouldShowTrackerGroupedStacksForCurrentUser(): boolean {
	return Boolean(game.user?.isGM);
}

export function shouldShowMinionGroupIdentityUiForCurrentUser(): boolean {
	return false;
}
