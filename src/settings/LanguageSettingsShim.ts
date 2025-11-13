import { LanguageSettings } from './LanguageSettings.svelte.js';

const { ApplicationV2 } = foundry.applications.api;

/**
 * Shim class to bridge Foundry's settings menu API with the new Svelte-based LanguageSettings dialog
 */
export default class LanguageSettingsShim extends ApplicationV2 {
	constructor() {
		super({});
		LanguageSettings.show();
	}

	override async render(): Promise<this> {
		this.close();
		return this;
	}
}
