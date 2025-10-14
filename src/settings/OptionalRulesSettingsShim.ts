import { OptionalRulesSettings } from './OptionalRulesSettings.svelte.js';

const { ApplicationV2 } = foundry.applications.api;

/**
 * Shim class to bridge Foundry's settings menu API with the new Svelte-based OptionalRulesSettings dialog
 */
export default class OptionalRulesSettingsShim extends ApplicationV2 {
	constructor() {
		super({});
		OptionalRulesSettings.show();
	}

	override async render(): Promise<this> {
		this.close();
		return this;
	}
}
