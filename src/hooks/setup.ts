import registerKeybindings from '../registerKeyBindings.js';
import registerSystemSettings from '../settings/index.js';
import { preparePackIndexes } from '../utils/preparePackIndexes.js';

export default function setup() {
	preparePackIndexes();
	registerKeybindings();
	registerSystemSettings();

	game.nimble.conditions.initialize();

	if (foundry.applications?.sheets) {
		// Make all FoundryVTT core applications resizable
		// This must be done in setup hook after ApplicationV2 classes are available
		// Card Stacks/Decks
		if (foundry.applications.sheets.CardsConfig) {
			const originalDefaultOptions = foundry.applications.sheets.CardsConfig.DEFAULT_OPTIONS;
			foundry.applications.sheets.CardsConfig.DEFAULT_OPTIONS = {
				...originalDefaultOptions,
				window: {
					...originalDefaultOptions.window,
					resizable: true,
				},
				position: {
					...originalDefaultOptions.position,
					height:
						originalDefaultOptions.position?.height === 'auto'
							? 500
							: originalDefaultOptions.position?.height,
				},
			};
		}

		// Playlist Sounds
		if (foundry.applications.sheets.PlaylistSoundConfig) {
			const originalDefaultOptions =
				foundry.applications.sheets.PlaylistSoundConfig.DEFAULT_OPTIONS;
			foundry.applications.sheets.PlaylistSoundConfig.DEFAULT_OPTIONS = {
				...originalDefaultOptions,
				window: {
					...originalDefaultOptions.window,
					resizable: true,
				},
				position: {
					...originalDefaultOptions.position,
					height:
						originalDefaultOptions.position?.height === 'auto'
							? 400
							: originalDefaultOptions.position?.height,
				},
			};
		}

		// Scene Configuration
		if (foundry.applications.sheets.SceneConfig) {
			const originalDefaultOptions = foundry.applications.sheets.SceneConfig.DEFAULT_OPTIONS;
			foundry.applications.sheets.SceneConfig.DEFAULT_OPTIONS = {
				...originalDefaultOptions,
				window: {
					...originalDefaultOptions.window,
					resizable: true,
				},
				position: {
					...originalDefaultOptions.position,
					height:
						originalDefaultOptions.position?.height === 'auto'
							? 600
							: originalDefaultOptions.position?.height,
				},
			};
		}

		// Compendium
		if (foundry.applications.sheets.CompendiumDirectory) {
			const originalDefaultOptions =
				foundry.applications.sheets.CompendiumDirectory.DEFAULT_OPTIONS;
			foundry.applications.sheets.CompendiumDirectory.DEFAULT_OPTIONS = {
				...originalDefaultOptions,
				window: {
					...originalDefaultOptions.window,
					resizable: true,
				},
				position: {
					...originalDefaultOptions.position,
					height:
						originalDefaultOptions.position?.height === 'auto'
							? 600
							: originalDefaultOptions.position?.height,
				},
			};
		}

		// Scene Directory (sidebar list)
		if (foundry.applications.sheets.SceneDirectory) {
			const originalDefaultOptions = foundry.applications.sheets.SceneDirectory.DEFAULT_OPTIONS;
			foundry.applications.sheets.SceneDirectory.DEFAULT_OPTIONS = {
				...originalDefaultOptions,
				window: {
					...originalDefaultOptions.window,
					resizable: true,
				},
				position: {
					...originalDefaultOptions.position,
					height:
						originalDefaultOptions.position?.height === 'auto'
							? 600
							: originalDefaultOptions.position?.height,
				},
			};
		}

		// Actors Directory (sidebar list)
		if (foundry.applications.sheets.ActorDirectory) {
			const originalDefaultOptions = foundry.applications.sheets.ActorDirectory.DEFAULT_OPTIONS;
			foundry.applications.sheets.ActorDirectory.DEFAULT_OPTIONS = {
				...originalDefaultOptions,
				window: {
					...originalDefaultOptions.window,
					resizable: true,
				},
				position: {
					...originalDefaultOptions.position,
					height:
						originalDefaultOptions.position?.height === 'auto'
							? 600
							: originalDefaultOptions.position?.height,
				},
			};
		}

		// Items Directory (sidebar list)
		if (foundry.applications.sheets.ItemDirectory) {
			const originalDefaultOptions = foundry.applications.sheets.ItemDirectory.DEFAULT_OPTIONS;
			foundry.applications.sheets.ItemDirectory.DEFAULT_OPTIONS = {
				...originalDefaultOptions,
				window: {
					...originalDefaultOptions.window,
					resizable: true,
				},
				position: {
					...originalDefaultOptions.position,
					height:
						originalDefaultOptions.position?.height === 'auto'
							? 600
							: originalDefaultOptions.position?.height,
				},
			};
		}

		// Journal Directory (sidebar list)
		if (foundry.applications.sheets.JournalDirectory) {
			const originalDefaultOptions = foundry.applications.sheets.JournalDirectory.DEFAULT_OPTIONS;
			foundry.applications.sheets.JournalDirectory.DEFAULT_OPTIONS = {
				...originalDefaultOptions,
				window: {
					...originalDefaultOptions.window,
					resizable: true,
				},
				position: {
					...originalDefaultOptions.position,
					height:
						originalDefaultOptions.position?.height === 'auto'
							? 600
							: originalDefaultOptions.position?.height,
				},
			};
		}

		// Rollable Tables Directory (sidebar list)
		if (foundry.applications.sheets.RollTableDirectory) {
			const originalDefaultOptions = foundry.applications.sheets.RollTableDirectory.DEFAULT_OPTIONS;
			foundry.applications.sheets.RollTableDirectory.DEFAULT_OPTIONS = {
				...originalDefaultOptions,
				window: {
					...originalDefaultOptions.window,
					resizable: true,
				},
				position: {
					...originalDefaultOptions.position,
					height:
						originalDefaultOptions.position?.height === 'auto'
							? 600
							: originalDefaultOptions.position?.height,
				},
			};
		}

		// Playlists Directory (sidebar list)
		if (foundry.applications.sheets.PlaylistDirectory) {
			const originalDefaultOptions = foundry.applications.sheets.PlaylistDirectory.DEFAULT_OPTIONS;
			foundry.applications.sheets.PlaylistDirectory.DEFAULT_OPTIONS = {
				...originalDefaultOptions,
				window: {
					...originalDefaultOptions.window,
					resizable: true,
				},
				position: {
					...originalDefaultOptions.position,
					height:
						originalDefaultOptions.position?.height === 'auto'
							? 600
							: originalDefaultOptions.position?.height,
				},
			};
		}

		// Cards Directory (sidebar list)
		if (foundry.applications.sheets.CardsDirectory) {
			const originalDefaultOptions = foundry.applications.sheets.CardsDirectory.DEFAULT_OPTIONS;
			foundry.applications.sheets.CardsDirectory.DEFAULT_OPTIONS = {
				...originalDefaultOptions,
				window: {
					...originalDefaultOptions.window,
					resizable: true,
				},
				position: {
					...originalDefaultOptions.position,
					height:
						originalDefaultOptions.position?.height === 'auto'
							? 600
							: originalDefaultOptions.position?.height,
				},
			};
		}
	}
}
