export const MINION_GROUPING_MODE_NCS = 'ncs';
export type MinionGroupingMode = typeof MINION_GROUPING_MODE_NCS;

export function shouldShowTrackerGroupedStacksForCurrentUser(): boolean {
	return Boolean(game.user?.isGM);
}
