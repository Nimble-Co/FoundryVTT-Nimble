import { SYSTEM_ID } from '#system';

export const ADJACENCY_SYNC_SETTING_KEY = 'autoTrackTokenAdjacency';
export const ADJACENCY_INCLUDES_DIAGONALS_SETTING_KEY = 'adjacencyIncludesDiagonals';

export function registerAdjacencySettings(): void {
	game.settings.register(
		SYSTEM_ID as 'core',
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
						if (actor.getFlag(SYSTEM_ID, 'adjacency')) {
							actor.unsetFlag(SYSTEM_ID, 'adjacency');
						}
					});
				}
			},
		} as unknown as Parameters<typeof game.settings.register>[2],
	);

	registerAdjacencyIncludesDiagonalsSetting();
}

export function getAdjacencySyncEnabled(): boolean {
	if (!game.settings.settings.has(`${SYSTEM_ID}.${ADJACENCY_SYNC_SETTING_KEY}` as 'core.rollMode'))
		return false;
	return Boolean(game.settings.get(SYSTEM_ID as 'core', ADJACENCY_SYNC_SETTING_KEY as 'rollMode'));
}

// Legacy. Adjacency now follows Foundry's own Grid Diagonals world setting, which offers the
// three options the rulebook gives. The key stays registered, hidden, so a stored value can be
// carried over once.
function registerAdjacencyIncludesDiagonalsSetting(): void {
	game.settings.register(
		SYSTEM_ID as 'core',
		ADJACENCY_INCLUDES_DIAGONALS_SETTING_KEY as 'rollMode',
		{
			name: 'NIMBLE.settings.adjacencyIncludesDiagonals.name',
			hint: 'NIMBLE.settings.adjacencyIncludesDiagonals.hint',
			scope: 'world',
			config: false,
			type: Boolean,
			default: true,
		} as unknown as Parameters<typeof game.settings.register>[2],
	);
}

function legacyDiagonalSettingExistsInStorage(): boolean {
	const storage = game.settings?.storage?.get('world') as
		| { contents?: { key?: string }[] }
		| undefined;
	const key = `${SYSTEM_ID}.${ADJACENCY_INCLUDES_DIAGONALS_SETTING_KEY}`;
	return Boolean(storage?.contents?.some((setting) => setting.key === key));
}

/**
 * Carries a stored "diagonals are not adjacent" choice over to Foundry's Grid Diagonals
 * setting, once, then marks the legacy key as handled. Runs on the GM client at ready.
 */
export async function migrateLegacyDiagonalSetting(): Promise<void> {
	if (!game.user?.isGM) return;
	if (!legacyDiagonalSettingExistsInStorage()) return;
	const legacyValue = Boolean(
		game.settings.get(SYSTEM_ID as 'core', ADJACENCY_INCLUDES_DIAGONALS_SETTING_KEY as 'rollMode'),
	);
	if (legacyValue) return;

	const coreDiagonals = game.settings.get(
		'core',
		'gridDiagonals' as 'rollMode',
	) as unknown as number;
	if (coreDiagonals === CONST.GRID_DIAGONALS.EQUIDISTANT) {
		await game.settings.set(
			'core',
			'gridDiagonals' as 'rollMode',
			CONST.GRID_DIAGONALS.ILLEGAL as never,
		);
		ui.notifications?.info(
			game.i18n.localize('NIMBLE.settings.adjacencyIncludesDiagonals.migrated'),
		);
	}
	await game.settings.set(
		SYSTEM_ID as 'core',
		ADJACENCY_INCLUDES_DIAGONALS_SETTING_KEY as 'rollMode',
		true as never,
	);
}
