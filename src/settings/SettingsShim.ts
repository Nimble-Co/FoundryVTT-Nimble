import { SystemSettings } from './SystemSettings.svelte.js';

const { ApplicationV2 } = foundry.applications.api;

/**
 * Shim class to bridge Foundry's settings menu API with the new Svelte-based SystemSettings dialog
 */
export default class SettingsShim extends ApplicationV2 {
	constructor() {
		super({});
		SystemSettings.show();
	}

	override async render(): Promise<this> {
		this.close();
		return this;
	}
}
