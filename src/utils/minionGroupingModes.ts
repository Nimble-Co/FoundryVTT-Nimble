export const MINION_GROUPING_MODE_NCS = 'ncs';
export type MinionGroupingMode = typeof MINION_GROUPING_MODE_NCS;

export function normalizeMinionGroupingMode(value: unknown): MinionGroupingMode {
	void value;
	return MINION_GROUPING_MODE_NCS;
}

export function getConfiguredMinionGroupingMode(): MinionGroupingMode {
	return MINION_GROUPING_MODE_NCS;
}

export function shouldUseNcsTemporaryGroups(): boolean {
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
