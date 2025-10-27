import { UISettings } from './UISettings.svelte.js';

const { ApplicationV2 } = foundry.applications.api;

/**
 * Shim class to bridge Foundry's settings menu API with the new Svelte-based UISettings dialog
 */
export default class UISettingsShim extends ApplicationV2 {
	constructor() {
		super({});
		UISettings.show();
	}

	override async render(): Promise<this> {
		this.close();
		return this;
	}
}
