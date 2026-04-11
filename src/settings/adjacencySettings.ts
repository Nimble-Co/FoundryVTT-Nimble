export const ADJACENCY_SYNC_SETTING_KEY = 'autoTrackTokenAdjacency';
export const ADJACENCY_INCLUDES_DIAGONALS_SETTING_KEY = 'adjacencyIncludesDiagonals';

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
			default: false,
			requiresReload: true,
			onChange: (value: boolean) => {
				if (!value) {
					// Tracking disabled — clear adjacency flags on all actors so stale
					// data doesn't persist across the required reload.
					game.actors?.forEach((actor) => {
						if (actor.getFlag('nimble', 'adjacency')) {
							actor.unsetFlag('nimble', 'adjacency');
						}
					});
				}
			},
		} as unknown as Parameters<typeof game.settings.register>[2],
	);

	registerAdjacencyIncludesDiagonalsSetting();
}

export function getAdjacencySyncEnabled(): boolean {
	if (!game.settings.settings.has(`nimble.${ADJACENCY_SYNC_SETTING_KEY}` as 'core.rollMode'))
		return false;
	return Boolean(game.settings.get('nimble' as 'core', ADJACENCY_SYNC_SETTING_KEY as 'rollMode'));
}

function registerAdjacencyIncludesDiagonalsSetting(): void {
	game.settings.register(
		'nimble' as 'core',
		ADJACENCY_INCLUDES_DIAGONALS_SETTING_KEY as 'rollMode',
		{
			name: 'NIMBLE.settings.adjacencyIncludesDiagonals.name',
			hint: 'NIMBLE.settings.adjacencyIncludesDiagonals.hint',
			scope: 'world',
			config: true,
			type: Boolean,
			default: true,
			requiresReload: true,
		} as unknown as Parameters<typeof game.settings.register>[2],
	);
}

export function getAdjacencyIncludesDiagonals(): boolean {
	return Boolean(
		game.settings.get('nimble' as 'core', ADJACENCY_INCLUDES_DIAGONALS_SETTING_KEY as 'rollMode'),
	);
}
