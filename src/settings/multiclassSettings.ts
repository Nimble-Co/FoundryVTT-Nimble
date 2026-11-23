import { SYSTEM_ID } from '#system';

export const MULTICLASSING_SETTING_KEY = 'multiclassing';

export function registerMulticlassSettings(): void {
	game.settings.register(
		SYSTEM_ID as 'core',
		MULTICLASSING_SETTING_KEY as 'rollMode',
		{
			name: 'NIMBLE.settings.multiclassing.name',
			hint: 'NIMBLE.settings.multiclassing.hint',
			scope: 'world',
			config: true,
			type: Boolean,
			default: false,
		} as unknown as Parameters<typeof game.settings.register>[2],
	);
}

/** The world allows a hero to take a level in a different class. Off before the setting is registered. */
export function multiclassingEnabled(): boolean {
	const registered = game.settings?.settings as { has: (key: string) => boolean } | undefined;
	if (!registered?.has(`${SYSTEM_ID}.${MULTICLASSING_SETTING_KEY}`)) return false;
	return Boolean(game.settings.get(SYSTEM_ID as 'core', MULTICLASSING_SETTING_KEY as 'rollMode'));
}
