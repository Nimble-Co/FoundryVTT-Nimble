import { SYSTEM_ID } from '#system';

export const OPEN_NPC_SHEETS_NARROW_SETTING_KEY = 'openNpcSheetsNarrow';
export const COLLAPSE_NPC_FEATURES_SETTING_KEY = 'collapseNpcFeatures';

export function registerActorSheetSettings(): void {
	game.settings.register(
		SYSTEM_ID as 'core',
		OPEN_NPC_SHEETS_NARROW_SETTING_KEY as 'rollMode',
		{
			name: 'NIMBLE.settings.openNpcSheetsNarrow.name',
			hint: 'NIMBLE.settings.openNpcSheetsNarrow.hint',
			scope: 'client',
			config: true,
			type: Boolean,
			default: false,
		} as unknown as Parameters<typeof game.settings.register>[2],
	);
	game.settings.register(
		SYSTEM_ID as 'core',
		COLLAPSE_NPC_FEATURES_SETTING_KEY as 'rollMode',
		{
			name: 'NIMBLE.settings.collapseNpcFeatures.name',
			hint: 'NIMBLE.settings.collapseNpcFeatures.hint',
			scope: 'client',
			config: true,
			type: Boolean,
			default: false,
		} as unknown as Parameters<typeof game.settings.register>[2],
	);
}

/** The value of a client setting of this file. Off before the setting is registered. */
function clientSetting(key: string): boolean {
	const registered = game.settings?.settings as { has: (key: string) => boolean } | undefined;
	if (!registered?.has(`${SYSTEM_ID}.${key}`)) return false;
	return Boolean(game.settings.get(SYSTEM_ID as 'core', key as 'rollMode'));
}

/** A new NPC sheet opens in the narrow form. */
export function openNpcSheetsNarrow(): boolean {
	return clientSetting(OPEN_NPC_SHEETS_NARROW_SETTING_KEY);
}

/** A new NPC sheet opens with the text of its ability cards closed. */
export function openNpcFeaturesCollapsed(): boolean {
	return clientSetting(COLLAPSE_NPC_FEATURES_SETTING_KEY);
}
