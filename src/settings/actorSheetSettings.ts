import { SYSTEM_ID } from '#system';

export const OPEN_NPC_SHEETS_NARROW_SETTING_KEY = 'openNpcSheetsNarrow';

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
}

/** A new NPC sheet opens in the narrow form. Off before the setting is registered. */
export function openNpcSheetsNarrow(): boolean {
	const registered = game.settings?.settings as { has: (key: string) => boolean } | undefined;
	if (!registered?.has(`${SYSTEM_ID}.${OPEN_NPC_SHEETS_NARROW_SETTING_KEY}`)) return false;
	return Boolean(
		game.settings.get(SYSTEM_ID as 'core', OPEN_NPC_SHEETS_NARROW_SETTING_KEY as 'rollMode'),
	);
}
