import { SvelteApplicationMixin } from '#lib/SvelteApplicationMixin.svelte.js';
import SystemSettingsDialog from '../view/dialogs/SystemSettingsDialog.svelte';

const { ApplicationV2 } = foundry.applications.api;

export class SystemSettings extends SvelteApplicationMixin(ApplicationV2) {
	static override DEFAULT_OPTIONS = foundry.utils.mergeObject(
		super.DEFAULT_OPTIONS,
		{
			id: `app-${Math.random().toString(36).substring(2, 9)}`,
			title: 'Configure System Settings',
			classes: ['nimble-sheet'],
			window: {
				icon: 'fa-solid fa-cog',
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
	root = SystemSettingsDialog;

	protected override async _prepareContext(
		_options: Parameters<foundry.applications.api.ApplicationV2['_prepareContext']>[0],
	): ReturnType<foundry.applications.api.ApplicationV2['_prepareContext']> {
		return {
			dialog: this,
		} as object as ReturnType<
			foundry.applications.api.ApplicationV2['_prepareContext']
		> extends Promise<infer T>
			? T
			: never;
	}

	getSettings() {
		const nimbleSettings = new Map();
		const gameSettings = game.settings;

		for (const [id, setting] of gameSettings.settings) {
			if (id.startsWith('nimble.')) {
				nimbleSettings.set(id, setting);
			}
		}
		return nimbleSettings;
	}
}
