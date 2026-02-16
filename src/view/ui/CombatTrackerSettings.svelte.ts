import { SvelteApplicationMixin } from '#lib/SvelteApplicationMixin.svelte.js';
import CombatTrackerSettingsWindow from './components/CombatTrackerSettingsWindow.svelte';

const { ApplicationV2 } = foundry.applications.api;

export default class CombatTrackerSettings extends SvelteApplicationMixin(ApplicationV2) {
	static #instance: CombatTrackerSettings | null = null;

	static open(): CombatTrackerSettings {
		if (CombatTrackerSettings.#instance?.rendered) {
			CombatTrackerSettings.#instance.bringToFront();
			return CombatTrackerSettings.#instance;
		}

		const settingsWindow = new CombatTrackerSettings();
		CombatTrackerSettings.#instance = settingsWindow;
		void settingsWindow.render(true);
		return settingsWindow;
	}

	static override DEFAULT_OPTIONS = foundry.utils.mergeObject(
		super.DEFAULT_OPTIONS,
		{
			id: 'nimble-combat-tracker-settings',
			title: 'Combat Tracker Settings',
			classes: ['nimble-sheet', 'nimble-sheet--combat-tracker-settings'],
			window: {
				title: 'Combat Tracker Settings',
				icon: 'fa-solid fa-gear',
				resizable: true,
			},
			position: {
				width: 640,
				height: 'auto',
			},
			actions: {},
		},
		{ inplace: false },
	);

	root = CombatTrackerSettingsWindow;

	protected override async _prepareContext(
		_options: Parameters<foundry.applications.api.ApplicationV2['_prepareContext']>[0],
	): ReturnType<foundry.applications.api.ApplicationV2['_prepareContext']> {
		return {
			dialog: this,
			isGM: game.user?.isGM ?? false,
		} as object as ReturnType<
			foundry.applications.api.ApplicationV2['_prepareContext']
		> extends Promise<infer T>
			? T
			: never;
	}

	override close(
		options?: Parameters<foundry.applications.api.ApplicationV2['close']>[0],
	): Promise<this> {
		CombatTrackerSettings.#instance = null;
		return super.close(options);
	}
}
