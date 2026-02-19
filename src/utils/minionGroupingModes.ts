export const MINION_GROUPING_MODE_SETTING_KEY = 'minionGroupingMode';
export const MINION_GROUPING_SHOW_IDENTITY_IN_CANVAS_PERSISTENT_SETTING_KEY =
	'showCanvasPersistentGroupIdentityUi';

export const MINION_GROUPING_MODE_FULL = 'full';
export const MINION_GROUPING_MODE_CANVAS_PERSISTENT = 'canvasPersistent';
export const MINION_GROUPING_MODE_CANVAS_LITE = 'canvasLite';

const NIMBLE_SYSTEM_ID = 'nimble' as 'core';

export type MinionGroupingMode =
	| typeof MINION_GROUPING_MODE_FULL
	| typeof MINION_GROUPING_MODE_CANVAS_PERSISTENT
	| typeof MINION_GROUPING_MODE_CANVAS_LITE;

function readNimbleSetting<T>(settingKey: string, fallbackValue: T): T {
	try {
		const settingsApi = game?.settings;
		if (!settingsApi?.get) return fallbackValue;

		const value = settingsApi.get(NIMBLE_SYSTEM_ID, settingKey as 'rollMode');
		if (value === undefined || value === null) return fallbackValue;
		return value as T;
	} catch (_error) {
		return fallbackValue;
	}
}

export function normalizeMinionGroupingMode(value: unknown): MinionGroupingMode {
	switch (value) {
		case MINION_GROUPING_MODE_CANVAS_PERSISTENT:
			return MINION_GROUPING_MODE_CANVAS_PERSISTENT;
		case MINION_GROUPING_MODE_CANVAS_LITE:
			return MINION_GROUPING_MODE_CANVAS_LITE;
		default:
			return MINION_GROUPING_MODE_FULL;
	}
}

export function getConfiguredMinionGroupingMode(): MinionGroupingMode {
	const configuredMode = readNimbleSetting<string>(
		MINION_GROUPING_MODE_SETTING_KEY,
		MINION_GROUPING_MODE_FULL,
	);
	return normalizeMinionGroupingMode(configuredMode);
}

export function shouldUseCanvasLiteTemporaryGroups(): boolean {
	return getConfiguredMinionGroupingMode() === MINION_GROUPING_MODE_CANVAS_LITE;
}

export function shouldShowTrackerGroupingControlsForCurrentUser(): boolean {
	if (!game.user?.isGM) return false;
	return getConfiguredMinionGroupingMode() === MINION_GROUPING_MODE_FULL;
}

export function shouldShowTrackerGroupedStacksForCurrentUser(): boolean {
	return Boolean(game.user?.isGM);
}

export function shouldShowMinionGroupIdentityUiForCurrentUser(): boolean {
	if (!game.user?.isGM) return false;

	const mode = getConfiguredMinionGroupingMode();
	if (mode === MINION_GROUPING_MODE_FULL) return true;
	if (mode === MINION_GROUPING_MODE_CANVAS_LITE) return false;

	return Boolean(
		readNimbleSetting<boolean>(
			MINION_GROUPING_SHOW_IDENTITY_IN_CANVAS_PERSISTENT_SETTING_KEY,
			false,
		),
	);
}
