import { SvelteApplicationMixin } from '#lib/SvelteApplicationMixin.svelte';
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

	async _prepareContext() {
		return {
			dialog: this,
		};
	}

	getSettings() {
		const nimbleSettings = new Map();
		const gameSettings = (game as any).settings;

		for (const [id, setting] of gameSettings.settings) {
			if (id.startsWith('nimble.')) {
				nimbleSettings.set(id, setting);
			}
		}
		return nimbleSettings;
	}
}
