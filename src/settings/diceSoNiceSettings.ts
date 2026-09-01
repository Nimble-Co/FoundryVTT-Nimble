import { SYSTEM_ID } from '#system';

export const DSN_PRIMARY_DIE_STYLE_ENABLED_SETTING_KEY = 'dsnPrimaryDieStyleEnabled';
export const DSN_PRIMARY_DIE_COLOR_SETTING_KEY = 'dsnPrimaryDieColor';
export const DSN_PRIMARY_DIE_LABEL_COLOR_SETTING_KEY = 'dsnPrimaryDieLabelColor';

export const DEFAULT_PRIMARY_DIE_COLOR = '#8a1c1c';
export const DEFAULT_PRIMARY_DIE_LABEL_COLOR = '#f5e7c1';

/** Module id of Dice So Nice, the only consumer of these preferences. */
export const DICE_SO_NICE_MODULE_ID = 'dice-so-nice';

/** User preferences controlling the primary die's 3D dice appearance. */
export interface PrimaryDiePreferences {
	enabled: boolean;
	background: string;
	foreground: string;
}

/** Whether Dice So Nice is installed and enabled in this world. */
export function isDiceSoNiceActive(): boolean {
	return Boolean(game.modules?.get(DICE_SO_NICE_MODULE_ID)?.active);
}

export function normalizeHexColor(value: unknown, fallback: string): string {
	if (value === null || value === undefined) return fallback;
	// ColorField-backed settings return a Color instance; its toString() is
	// the css hex form. Plain strings pass through unchanged.
	const normalized = String(value).trim().toLowerCase();
	if (/^#[0-9a-f]{6}$/.test(normalized)) return normalized;
	const shortHexMatch = /^#([0-9a-f]{3})$/.exec(normalized);
	if (shortHexMatch) {
		const [red, green, blue] = [...shortHexMatch[1]];
		return `#${red}${red}${green}${green}${blue}${blue}`;
	}
	return fallback;
}

/**
 * Read a system setting, returning `undefined` when the settings registry is
 * unavailable or the key is not registered (e.g. in unit tests or before the
 * setup hook has run).
 */
function getSettingSafe(key: string): unknown {
	const settingsMap = game.settings?.settings as { has: (key: string) => boolean } | undefined;
	if (!settingsMap?.has(`${SYSTEM_ID}.${key}`)) return undefined;
	return game.settings.get(SYSTEM_ID as 'core', key as 'rollMode');
}

/**
 * The current user's primary die appearance preferences, falling back to the
 * system defaults when the settings are unavailable.
 */
export function getPrimaryDiePreferences(): PrimaryDiePreferences {
	return {
		enabled: getSettingSafe(DSN_PRIMARY_DIE_STYLE_ENABLED_SETTING_KEY) !== false,
		background: normalizeHexColor(
			getSettingSafe(DSN_PRIMARY_DIE_COLOR_SETTING_KEY),
			DEFAULT_PRIMARY_DIE_COLOR,
		),
		foreground: normalizeHexColor(
			getSettingSafe(DSN_PRIMARY_DIE_LABEL_COLOR_SETTING_KEY),
			DEFAULT_PRIMARY_DIE_LABEL_COLOR,
		),
	};
}

/** Stores the current user's primary die appearance preferences. */
export async function setPrimaryDiePreferences(preferences: PrimaryDiePreferences): Promise<void> {
	await game.settings.set(
		SYSTEM_ID as 'core',
		DSN_PRIMARY_DIE_STYLE_ENABLED_SETTING_KEY as 'rollMode',
		preferences.enabled as never,
	);
	await game.settings.set(
		SYSTEM_ID as 'core',
		DSN_PRIMARY_DIE_COLOR_SETTING_KEY as 'rollMode',
		normalizeHexColor(preferences.background, DEFAULT_PRIMARY_DIE_COLOR) as never,
	);
	await game.settings.set(
		SYSTEM_ID as 'core',
		DSN_PRIMARY_DIE_LABEL_COLOR_SETTING_KEY as 'rollMode',
		normalizeHexColor(preferences.foreground, DEFAULT_PRIMARY_DIE_LABEL_COLOR) as never,
	);
}
