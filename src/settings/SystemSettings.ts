import { SvelteApplicationMixin } from '#lib/SvelteApplicationMixin.svelte.js';
import SystemSettingsDialog from '../view/dialogs/SystemSettingsDialog.svelte';

const { ApplicationV2 } = foundry.applications.api;

export class SystemSettings extends SvelteApplicationMixin(ApplicationV2) {
	static override DEFAULT_OPTIONS = {
		id: `app-${Math.random().toString(36).substring(2, 9)}`,
		classes: ['nimble-sheet'],
		window: {
			icon: 'fa-solid fa-cog',
			title: 'Configure System Settings',
			resizable: true,
		},
		position: {
			width: 640,
			height: 'auto' as const,
		},
		actions: {},
	};

	protected root = SystemSettingsDialog;

	constructor() {
		super();
		this.props = {
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
