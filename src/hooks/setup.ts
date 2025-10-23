// @ts-nocheck - Foundry type definition circular references
import registerKeybindings from '../registerKeyBindings.js';
import registerSystemSettings from '../settings/index.js';
import { preparePackIndexes } from '../utils/preparePackIndexes.js';

/**
 * Helper function to make an ApplicationV2 class resizable.
 * Modifies the DEFAULT_OPTIONS to enable window resizing without changing other defaults.
 * @param appClass - The ApplicationV2 class to modify
 * @returns true if successful, false otherwise
 */
function makeApplicationDialogResizable(appClass: any): boolean {
	try {
		if (!appClass?.DEFAULT_OPTIONS) {
			return false;
		}

		const originalDefaultOptions = appClass.DEFAULT_OPTIONS;

		// Validate the structure before modifying
		if (typeof originalDefaultOptions !== 'object') {
			console.warn(
				`Nimble: Unable to modify ${appClass.name} - unexpected DEFAULT_OPTIONS structure`,
			);
			return false;
		}

		appClass.DEFAULT_OPTIONS = {
			...originalDefaultOptions,
			window: {
				...(originalDefaultOptions.window || {}),
				resizable: true,
			},
		};

		return true;
	} catch (error) {
		console.error(`Nimble: Error making ${appClass?.name} resizable:`, error);
		return false;
	}
}

export default function setup() {
	preparePackIndexes();
	registerKeybindings();
	registerSystemSettings();

	game.nimble.conditions.initialize();

	if (!foundry.applications?.sheets) {
		console.warn('Nimble: ApplicationV2 sheets not available, skipping resizable configuration');
		return;
	}

	// Make FoundryVTT core dialog windows resizable
	// This must be done in setup hook after ApplicationV2 classes are available
	const configurableApps = [
		'CardsConfig', // Card Stacks/Decks
		'PlaylistSoundConfig', // Playlist Sounds
		'PlaylistConfig', // Playlist Configuration
		'SceneConfig', // Scene Configuration
		'Compendium', // Compendium Pack Dialog
		'SceneDirectory', // Scene Directory Dialog
		'ActorDirectory', // Actors Directory Dialog
		'ItemDirectory', // Items Directory Dialog
		'JournalDirectory', // Journal Directory Dialog
		'RollTableDirectory', // Rollable Tables Directory Dialog
		'PlaylistDirectory', // Playlists Directory Dialog
		'CardsDirectory', // Cards Directory Dialog
	] as const;

	for (const className of configurableApps) {
		const appClass = foundry.applications.sheets?.[className];
		if (appClass) {
			makeApplicationDialogResizable(appClass);
		}
	}
}
