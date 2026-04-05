export const ADJACENCY_SYNC_SETTING_KEY = 'autoTrackTokenAdjacency';

export function registerAdjacencySettings(): void {
	game.settings.register(
		'nimble' as 'core',
		ADJACENCY_SYNC_SETTING_KEY as 'rollMode',
		{
			name: 'NIMBLE.settings.autoTrackTokenAdjacency.name',
			hint: 'NIMBLE.settings.autoTrackTokenAdjacency.hint',
			scope: 'world',
			config: true,
			type: Boolean,
			default: true,
		} as unknown as Parameters<typeof game.settings.register>[2],
	);
}

export function getAdjacencySyncEnabled(): boolean {
	return Boolean(game.settings.get('nimble' as 'core', ADJACENCY_SYNC_SETTING_KEY as 'rollMode'));
}
